use std::path::Path;
#[cfg(unix)]
use std::time::{Duration, Instant};

#[cfg(unix)]
use env_core::secret_input_socket_path;
use env_core::{SecretInputEntry, SecretInputRequest, SecretInputResponse};

use super::super::*;

const DEFAULT_TIMEOUT_SECONDS: u64 = 300;
const MIN_TIMEOUT_SECONDS: u64 = 30;
const MAX_TIMEOUT_SECONDS: u64 = 900;
const MAX_ENTRIES: usize = 16;
#[cfg(unix)]
const SOCKET_READY_WAIT: Duration = Duration::from_secs(10);

impl Broker {
    pub(super) fn request_value_input(
        &self,
        args: RequestValueInputArgs,
    ) -> Result<Value, EnvError> {
        let service = self.open_registered(&args.project_path)?;
        let app_data = self.provider_app_data()?;
        let entries = normalize_entries(args.entries)?;
        let names = entries
            .iter()
            .map(|entry| entry.name.clone())
            .collect::<Vec<_>>();
        let timeout_seconds = args
            .timeout_seconds
            .unwrap_or(DEFAULT_TIMEOUT_SECONDS)
            .clamp(MIN_TIMEOUT_SECONDS, MAX_TIMEOUT_SECONDS);
        let request = SecretInputRequest {
            request_id: new_request_id(),
            project_root: service.root().to_string_lossy().into_owned(),
            timeout_seconds,
            entries,
        };
        let response = request_secret_input(&app_data, &request);
        let result_code = response
            .as_ref()
            .map_or_else(|error| error.code().as_str(), |_| "OK");
        self.audit(
            service.project_id(),
            "request_value_input",
            &[],
            &names,
            "human-secret-input",
            result_code,
        );
        serde_json::to_value(response?).map_err(EnvError::serialization)
    }
}

fn normalize_entries(entries: Vec<SecretInputEntry>) -> Result<Vec<SecretInputEntry>, EnvError> {
    if entries.is_empty() || entries.len() > MAX_ENTRIES {
        return Err(EnvError::invalid(
            "값 입력 요청에는 1~16개 항목이 필요합니다.",
        ));
    }
    for entry in &entries {
        let valid_name = !entry.name.is_empty()
            && entry.name.len() <= 256
            && entry
                .name
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'));
        if !valid_name || entry.file.is_empty() || entry.file.len() > 512 {
            return Err(EnvError::invalid(
                "값 입력 요청의 이름 또는 파일이 올바르지 않습니다.",
            ));
        }
    }
    Ok(entries)
}

fn new_request_id() -> String {
    let mut bytes = [0_u8; 16];
    if getrandom::fill(&mut bytes).is_err() {
        return format!("req-{}", std::process::id());
    }
    let mut id = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        id.push_str(&format!("{byte:02x}"));
    }
    id
}

#[cfg(unix)]
fn request_secret_input(
    app_data: &Path,
    request: &SecretInputRequest,
) -> Result<SecretInputResponse, EnvError> {
    use std::io::{BufRead, BufReader, Write};
    use std::os::unix::net::UnixStream;

    let path = secret_input_socket_path(app_data);
    if !path.exists() {
        launch_desktop_app();
        let deadline = Instant::now() + SOCKET_READY_WAIT;
        while !path.exists() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(150));
        }
    }
    let stream = UnixStream::connect(&path).map_err(|_| {
        EnvError::invalid(
            "Kavranta 데스크톱 앱에 연결하지 못했습니다. 앱을 실행한 뒤 다시 시도해주세요.",
        )
    })?;
    let read_timeout = Duration::from_secs(request.timeout_seconds + 20);
    let _ = stream.set_read_timeout(Some(read_timeout));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(10)));
    let mut writer = stream.try_clone().map_err(|_| connection_failed())?;
    let payload = serde_json::to_vec(request).map_err(EnvError::serialization)?;
    writer
        .write_all(&payload)
        .map_err(|_| connection_failed())?;
    writer.write_all(b"\n").map_err(|_| connection_failed())?;
    writer.flush().map_err(|_| connection_failed())?;

    let mut reader = BufReader::new(stream);
    let mut line = String::new();
    reader.read_line(&mut line).map_err(|_| {
        EnvError::invalid("값 입력 응답을 받지 못했습니다. 앱에서 다시 시도해주세요.")
    })?;
    let response: SecretInputResponse =
        serde_json::from_str(line.trim()).map_err(|_| connection_failed())?;
    if response.request_id != request.request_id {
        return Err(connection_failed());
    }
    Ok(response)
}

#[cfg(not(unix))]
fn request_secret_input(
    _app_data: &Path,
    request: &SecretInputRequest,
) -> Result<SecretInputResponse, EnvError> {
    let names = request
        .entries
        .iter()
        .map(|entry| entry.name.clone())
        .collect::<Vec<_>>();
    Ok(SecretInputResponse::all(
        &request.request_id,
        &names,
        env_core::SecretInputOutcome::Failed,
    ))
}

#[cfg(unix)]
fn connection_failed() -> EnvError {
    EnvError::invalid("값 입력 요청을 처리하지 못했습니다.")
}

#[cfg(target_os = "macos")]
fn launch_desktop_app() {
    let _ = std::process::Command::new("open")
        .arg("-a")
        .arg("Kavranta")
        .spawn();
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch_desktop_app() {}
