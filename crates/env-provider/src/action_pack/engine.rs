use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::io::{Read, Write};
use std::process::Stdio;
use std::time::{Duration, Instant};

use env_core::{ProjectService, ProviderValue};
use reqwest::header::{CONTENT_TYPE, HeaderMap, HeaderName, HeaderValue};
use serde_json::Value;
use wait_timeout::ChildExt;
use zeroize::Zeroizing;

use super::error::{ActionPackError, invalid_request};
use super::model::{
    ActionDefinition, ActionExecutionRequest, ActionExecutionResult, ActionKind, ActionPackInfo,
    HttpActionMethod, HttpRequestBodyPolicy, HttpResponseProjection,
};
use super::storage::{ResolvedActionPack, pack_info, resolve};
use crate::provider_push::cli::provider_command;

const MAX_REQUEST_BODY_BYTES: usize = 256 * 1024;
const MAX_PROJECTED_VALUE_BYTES: usize = 64 * 1024;
const REDACTED_VALUE: &str = "[redacted]";

pub fn prepare(
    root: &std::path::Path,
    app_data: &std::path::Path,
    request: &ActionExecutionRequest,
) -> Result<ActionPackInfo, ActionPackError> {
    let resolved = resolve(&request.pack_id, root, app_data)?;
    validate_bindings(&resolved, &request.bindings)?;
    ensure_body_shape(&resolved, request)?;
    Ok(pack_info(&resolved.manifest, Some(&resolved)))
}

fn ensure_body_shape(
    resolved: &ResolvedActionPack,
    request: &ActionExecutionRequest,
) -> Result<(), ActionPackError> {
    match &resolved.manifest.action {
        ActionDefinition::Http { request_body, .. } => match request_body {
            Some(policy) => {
                let raw = request.body.as_deref().ok_or_else(invalid_request)?;
                validate_body_shape(policy, raw).map(|_| ())
            }
            None => match &request.body {
                Some(_) => Err(invalid_request()),
                None => Ok(()),
            },
        },
        ActionDefinition::Cli { .. } => match &request.body {
            Some(_) => Err(invalid_request()),
            None => Ok(()),
        },
    }
}

pub fn execute(
    service: &ProjectService,
    app_data: &std::path::Path,
    request: ActionExecutionRequest,
) -> Result<ActionExecutionResult, ActionPackError> {
    let resolved = resolve(&request.pack_id, service.root(), app_data)?;
    validate_bindings(&resolved, &request.bindings)?;
    let keys = request
        .bindings
        .values()
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect::<Vec<_>>();
    let values = service.provider_values(&request.file, &keys)?;
    let values = values
        .iter()
        .map(|value| (value.key(), value))
        .collect::<BTreeMap<_, _>>();

    match &resolved.manifest.action {
        ActionDefinition::Cli { .. } => execute_cli(service, &resolved, &request, &values),
        ActionDefinition::Http { .. } => execute_http(&resolved, &request, &values),
    }
}

fn validate_bindings(
    resolved: &ResolvedActionPack,
    bindings: &BTreeMap<String, String>,
) -> Result<(), ActionPackError> {
    let expected = match &resolved.manifest.action {
        ActionDefinition::Cli { secret_binding, .. } => BTreeSet::from([secret_binding.as_str()]),
        ActionDefinition::Http {
            secret_bindings, ..
        } => secret_bindings.keys().map(String::as_str).collect(),
    };
    let received = bindings.keys().map(String::as_str).collect::<BTreeSet<_>>();
    if expected != received
        || bindings.values().any(|key| {
            key.is_empty()
                || key.len() > 256
                || !key
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'))
        })
    {
        return Err(invalid_request());
    }
    Ok(())
}

fn execute_cli(
    service: &ProjectService,
    resolved: &ResolvedActionPack,
    request: &ActionExecutionRequest,
    values: &BTreeMap<&str, &ProviderValue>,
) -> Result<ActionExecutionResult, ActionPackError> {
    let ActionDefinition::Cli {
        secret_binding,
        result_policy,
        timeout_seconds,
        ..
    } = &resolved.manifest.action
    else {
        return Err(invalid_request());
    };
    let cli = resolved.cli.as_ref().ok_or(ActionPackError::new(
        "ACTION_CLI_UNSUPPORTED",
        "Action CLI를 실행할 수 없습니다.",
    ))?;
    let variable_name = request
        .bindings
        .get(secret_binding)
        .ok_or_else(invalid_request)?;
    let value = values
        .get(variable_name.as_str())
        .ok_or_else(invalid_request)?;
    let args = cli
        .profile
        .arguments
        .iter()
        .map(|argument| {
            let rendered = argument.replace("{variableName}", variable_name);
            if rendered.contains(['{', '}']) || rendered.len() > 512 {
                return Err(invalid_request());
            }
            Ok(OsString::from(rendered))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let started = Instant::now();
    let mut command = provider_command(&cli.executable, &args);
    for variable in [
        "DEBUG",
        "NODE_DEBUG",
        "RUST_LOG",
        "SSLKEYLOGFILE",
        "WRANGLER_LOG",
    ] {
        command.env_remove(variable);
    }
    let mut child = command
        .current_dir(service.root())
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| {
            ActionPackError::new("ACTION_CLI_FAILED", "Action CLI를 시작하지 못했습니다.")
        })?;
    let mut stdin = child.stdin.take().ok_or(ActionPackError::new(
        "ACTION_CLI_FAILED",
        "Action CLI의 비밀 입력 채널을 열지 못했습니다.",
    ))?;
    let timeout = Duration::from_secs(*timeout_seconds);
    let (status, wrote) = std::thread::scope(|scope| {
        let writer = scope.spawn(move || stdin.write_all(value.value().as_bytes()).is_ok());
        let status = child.wait_timeout(timeout);
        if matches!(status, Ok(None)) {
            let _ = child.kill();
            let _ = child.wait();
        }
        let wrote = writer.join().unwrap_or(false);
        (status, wrote)
    });
    let elapsed = elapsed_ms(started);
    let status = status.map_err(|_| {
        ActionPackError::new(
            "ACTION_CLI_FAILED",
            "Action CLI 실행 상태를 확인하지 못했습니다.",
        )
    })?;
    let Some(status) = status else {
        return Ok(ActionExecutionResult {
            pack_id: resolved.manifest.id.clone(),
            kind: ActionKind::Cli,
            succeeded: false,
            status_code: None,
            duration_ms: result_policy.duration.then_some(elapsed),
            exit_code: None,
            result_code: "ACTION_TIMEOUT".to_owned(),
            output: None,
        });
    };
    if !wrote {
        return Err(ActionPackError::new(
            "ACTION_CLI_FAILED",
            "Action CLI에 값을 전달하지 못했습니다.",
        ));
    }
    let succeeded = status.success();
    Ok(ActionExecutionResult {
        pack_id: resolved.manifest.id.clone(),
        kind: ActionKind::Cli,
        succeeded,
        status_code: None,
        duration_ms: result_policy.duration.then_some(elapsed),
        exit_code: result_policy.exit_code.then(|| status.code()).flatten(),
        result_code: if succeeded {
            "ACTION_SUCCEEDED"
        } else {
            "ACTION_CLI_EXITED"
        }
        .to_owned(),
        output: None,
    })
}

fn execute_http(
    resolved: &ResolvedActionPack,
    request: &ActionExecutionRequest,
    values: &BTreeMap<&str, &ProviderValue>,
) -> Result<ActionExecutionResult, ActionPackError> {
    let ActionDefinition::Http {
        method,
        url,
        secret_bindings,
        request_body,
        response_projection,
        result_policy,
        timeout_seconds,
    } = &resolved.manifest.action
    else {
        return Err(invalid_request());
    };
    let mut headers = HeaderMap::new();
    let mut secrets = Vec::new();
    for (binding_id, binding) in secret_bindings {
        let variable_name = request
            .bindings
            .get(binding_id)
            .ok_or_else(invalid_request)?;
        let value = values
            .get(variable_name.as_str())
            .ok_or_else(invalid_request)?;
        secrets.push(Zeroizing::new(value.value().to_owned()));
        let rendered = Zeroizing::new(binding.format.replace("{value}", value.value()));
        let name = binding.name.as_deref().unwrap_or(binding_id);
        let name = HeaderName::from_bytes(name.as_bytes()).map_err(|_| invalid_request())?;
        let mut header_value = HeaderValue::from_str(rendered.as_str()).map_err(|_| {
            ActionPackError::new(
                "ACTION_VALUE_UNREPRESENTABLE",
                "선택한 값을 HTTP 헤더로 안전하게 표현할 수 없습니다.",
            )
        })?;
        header_value.set_sensitive(true);
        headers.insert(name, header_value);
    }

    let body = match request_body {
        Some(policy) => {
            let raw = request.body.as_deref().ok_or_else(invalid_request)?;
            Some(validate_request_body(policy, raw, &secrets)?)
        }
        None => {
            if request.body.is_some() {
                return Err(invalid_request());
            }
            None
        }
    };

    ensure_http_crypto_provider()?;
    let client = reqwest::blocking::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .referer(false)
        .timeout(Duration::from_secs(*timeout_seconds))
        .build()
        .map_err(|_| {
            ActionPackError::new("ACTION_HTTP_FAILED", "HTTP Action을 준비하지 못했습니다.")
        })?;
    let started = Instant::now();
    let mut builder = client.request(http_method(*method), url).headers(headers);
    if let Some(body) = &body {
        builder = builder
            .header(CONTENT_TYPE, "application/json")
            .body(body.as_str().to_owned());
    }
    let response = builder.send().map_err(|_| {
        ActionPackError::new(
            "ACTION_HTTP_FAILED",
            "HTTP Action 요청을 완료하지 못했습니다.",
        )
    })?;
    let elapsed = elapsed_ms(started);
    let status = response.status().as_u16();
    let succeeded = if result_policy.success_status_codes.is_empty() {
        response.status().is_success()
    } else {
        result_policy.success_status_codes.contains(&status)
    };
    let output = match response_projection {
        Some(projection) => project_response(projection, response, &secrets)?,
        None => {
            drop(response);
            None
        }
    };

    Ok(ActionExecutionResult {
        pack_id: resolved.manifest.id.clone(),
        kind: ActionKind::Http,
        succeeded,
        status_code: result_policy.status.then_some(status),
        duration_ms: result_policy.duration.then_some(elapsed),
        exit_code: None,
        result_code: if succeeded {
            "ACTION_SUCCEEDED"
        } else {
            "ACTION_HTTP_STATUS_REJECTED"
        }
        .to_owned(),
        output,
    })
}

fn validate_request_body(
    policy: &HttpRequestBodyPolicy,
    raw: &str,
    secrets: &[Zeroizing<String>],
) -> Result<Zeroizing<String>, ActionPackError> {
    let serialized = Zeroizing::new(
        serde_json::to_string(&validate_body_shape(policy, raw)?).map_err(|_| invalid_request())?,
    );
    if secrets
        .iter()
        .any(|secret| !secret.is_empty() && serialized.contains(secret.as_str()))
    {
        return Err(ActionPackError::new(
            "ACTION_BODY_REJECTED",
            "요청 본문에 비밀 값을 넣을 수 없습니다.",
        ));
    }
    Ok(serialized)
}

fn validate_body_shape(
    policy: &HttpRequestBodyPolicy,
    raw: &str,
) -> Result<Value, ActionPackError> {
    if raw.len() > MAX_REQUEST_BODY_BYTES {
        return Err(invalid_request());
    }
    let parsed: Value = serde_json::from_str(raw).map_err(|_| invalid_request())?;
    let Value::Object(map) = parsed else {
        return Err(invalid_request());
    };
    if map.is_empty()
        || map
            .keys()
            .any(|key| !policy.fields.iter().any(|field| field == key))
    {
        return Err(invalid_request());
    }
    Ok(Value::Object(map))
}

fn project_response(
    projection: &HttpResponseProjection,
    response: reqwest::blocking::Response,
    secrets: &[Zeroizing<String>],
) -> Result<Option<BTreeMap<String, String>>, ActionPackError> {
    let limit = usize::try_from(projection.max_bytes).unwrap_or(usize::MAX);
    let mut buffer = Vec::new();
    response
        .take(u64::try_from(limit + 1).unwrap_or(u64::MAX))
        .read_to_end(&mut buffer)
        .map_err(|_| {
            ActionPackError::new("ACTION_HTTP_FAILED", "HTTP Action 응답을 읽지 못했습니다.")
        })?;
    if buffer.len() > limit {
        return Err(ActionPackError::new(
            "ACTION_HTTP_RESPONSE_TOO_LARGE",
            "HTTP Action 응답이 허용 크기를 초과했습니다.",
        ));
    }
    let parsed: Value = serde_json::from_slice(&buffer).map_err(|_| {
        ActionPackError::new(
            "ACTION_HTTP_INVALID_RESPONSE",
            "HTTP Action 응답을 안전하게 해석하지 못했습니다.",
        )
    })?;
    let mut output = BTreeMap::new();
    for (result_key, path) in &projection.fields {
        let Some(projected) = resolve_projection_path(&parsed, path) else {
            continue;
        };
        let text = match projected {
            Value::Null => continue,
            Value::String(value) => value.clone(),
            other => other.to_string(),
        };
        if text.len() > MAX_PROJECTED_VALUE_BYTES {
            return Err(ActionPackError::new(
                "ACTION_HTTP_RESPONSE_TOO_LARGE",
                "HTTP Action 응답 항목이 허용 크기를 초과했습니다.",
            ));
        }
        output.insert(result_key.clone(), scrub(text, secrets));
    }
    Ok(Some(output))
}

fn resolve_projection_path<'a>(value: &'a Value, path: &str) -> Option<&'a Value> {
    let mut current = value;
    for segment in path.split('.') {
        current = match current {
            Value::Object(map) => map.get(segment)?,
            Value::Array(items) => items.get(segment.parse::<usize>().ok()?)?,
            _ => return None,
        };
    }
    Some(current)
}

fn scrub(text: String, secrets: &[Zeroizing<String>]) -> String {
    if secrets
        .iter()
        .any(|secret| !secret.is_empty() && text.contains(secret.as_str()))
    {
        return REDACTED_VALUE.to_owned();
    }
    text
}

fn ensure_http_crypto_provider() -> Result<(), ActionPackError> {
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();
    }
    if rustls::crypto::CryptoProvider::get_default().is_none() {
        return Err(ActionPackError::new(
            "ACTION_HTTP_FAILED",
            "HTTP Action의 암호화 구성을 준비하지 못했습니다.",
        ));
    }
    Ok(())
}

fn http_method(method: HttpActionMethod) -> reqwest::Method {
    match method {
        HttpActionMethod::Get => reqwest::Method::GET,
        HttpActionMethod::Head => reqwest::Method::HEAD,
        HttpActionMethod::Post => reqwest::Method::POST,
        HttpActionMethod::Put => reqwest::Method::PUT,
        HttpActionMethod::Patch => reqwest::Method::PATCH,
        HttpActionMethod::Delete => reqwest::Method::DELETE,
    }
}

fn elapsed_ms(started: Instant) -> u64 {
    u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX)
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;
    use std::fs;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    use super::*;
    use crate::action_pack::{
        ActionPackManifest, HttpActionMethod, HttpBodyContentType, HttpRequestBodyPolicy,
        HttpResponseProjection, HttpResultPolicy, HttpSecretBinding, HttpSecretSource, install,
    };
    #[cfg(unix)]
    use crate::action_pack::{CliActionProfile, CliResultPolicy, CliSecretTransport};

    #[test]
    fn http_action_returns_only_allowlisted_metadata_even_when_the_body_echoes_the_secret() {
        let canary = "fake_ACTION_PACK_SECRET_92";
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let address = listener.local_addr().expect("address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut request = [0_u8; 4096];
            let size = stream.read(&mut request).expect("read request");
            let request = String::from_utf8_lossy(&request[..size]);
            assert!(
                request
                    .to_ascii_lowercase()
                    .contains(&format!("authorization: bearer {canary}").to_ascii_lowercase())
            );
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                canary.len(),
                canary
            )
            .expect("response");
        });

        let project = tempfile::tempdir().expect("project");
        fs::write(
            project.path().join(".env.local"),
            format!("SERVICE_API_KEY={canary}\n"),
        )
        .expect("fixture");
        let service = ProjectService::open(project.path()).expect("service");
        service.initialize().expect("initialize");
        let app_data = tempfile::tempdir().expect("app data");
        let source = tempfile::tempdir().expect("source");
        let manifest = ActionPackManifest {
            schema_version: 1,
            id: "local.example.api-check".to_owned(),
            display_name: "API check".to_owned(),
            description: "Synthetic API check".to_owned(),
            pack_version: "1.0.0".to_owned(),
            action_protocol_version: "0.1.0".to_owned(),
            action: ActionDefinition::Http {
                method: HttpActionMethod::Get,
                url: format!("http://{address}/health"),
                secret_bindings: BTreeMap::from([(
                    "Authorization".to_owned(),
                    HttpSecretBinding {
                        source: HttpSecretSource::Header,
                        name: None,
                        format: "Bearer {value}".to_owned(),
                    },
                )]),
                request_body: None,
                response_projection: None,
                result_policy: HttpResultPolicy {
                    status: true,
                    duration: true,
                    body: false,
                    success_status_codes: vec![200],
                },
                timeout_seconds: 5,
            },
        };
        fs::write(
            source.path().join("action.json"),
            serde_json::to_vec(&manifest).expect("manifest"),
        )
        .expect("write manifest");
        install(source.path(), app_data.path(), false).expect("install");

        let result = execute(
            &service,
            app_data.path(),
            ActionExecutionRequest {
                pack_id: manifest.id,
                file: ".env.local".to_owned(),
                bindings: BTreeMap::from([(
                    "Authorization".to_owned(),
                    "SERVICE_API_KEY".to_owned(),
                )]),
                body: None,
            },
        )
        .expect("execute");
        server.join().expect("server");

        assert!(result.succeeded);
        assert_eq!(result.status_code, Some(200));
        assert!(
            !serde_json::to_string(&result)
                .expect("result")
                .contains(canary)
        );
    }

    #[cfg(unix)]
    #[test]
    fn cli_action_uses_name_only_arguments_and_discards_secret_bearing_output() {
        use std::os::unix::fs::PermissionsExt;

        let canary = "fake_ACTION_CLI_SECRET_81";
        let project = tempfile::tempdir().expect("project");
        fs::write(
            project.path().join(".env.local"),
            format!("SERVICE_API_KEY={canary}\n"),
        )
        .expect("fixture");
        let service = ProjectService::open(project.path()).expect("service");
        service.initialize().expect("initialize");
        let app_data = tempfile::tempdir().expect("app data");
        let source = tempfile::tempdir().expect("source");
        let runner = tempfile::tempdir().expect("runner");
        let executable = runner.path().join("fake-action");
        let stdin_capture = runner.path().join("stdin.txt");
        let name_capture = runner.path().join("name.txt");
        fs::write(
            &executable,
            "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then printf '2.1.0\\n'; exit 0; fi\nstdin_file=$1\nname_file=$2\nvariable_name=$3\nprintf '%s' \"$variable_name\" > \"$name_file\"\ncat > \"$stdin_file\"\nprintf '%s' \"$(cat \"$stdin_file\")\"\nprintf '%s' \"$(cat \"$stdin_file\")\" >&2\n",
        )
        .expect("runner source");
        let mut permissions = fs::metadata(&executable).expect("metadata").permissions();
        permissions.set_mode(0o700);
        fs::set_permissions(&executable, permissions).expect("permissions");
        let manifest = ActionPackManifest {
            schema_version: 1,
            id: "local.example.cli-check".to_owned(),
            display_name: "CLI check".to_owned(),
            description: "Synthetic CLI action".to_owned(),
            pack_version: "1.0.0".to_owned(),
            action_protocol_version: "0.1.0".to_owned(),
            action: ActionDefinition::Cli {
                executable_candidates: vec![executable.to_string_lossy().into_owned()],
                version_args: vec!["--version".to_owned()],
                profiles: vec![CliActionProfile {
                    id: "fake-v2".to_owned(),
                    version_requirement: ">=2,<3".to_owned(),
                    arguments: vec![
                        stdin_capture.to_string_lossy().into_owned(),
                        name_capture.to_string_lossy().into_owned(),
                        "{variableName}".to_owned(),
                    ],
                }],
                secret_binding: "value".to_owned(),
                secret_transport: CliSecretTransport::Stdin,
                result_policy: CliResultPolicy {
                    success: true,
                    exit_code: true,
                    duration: true,
                },
                timeout_seconds: 5,
            },
        };
        fs::write(
            source.path().join("action.json"),
            serde_json::to_vec(&manifest).expect("manifest"),
        )
        .expect("write manifest");
        install(source.path(), app_data.path(), false).expect("install");

        let result = execute(
            &service,
            app_data.path(),
            ActionExecutionRequest {
                pack_id: manifest.id,
                file: ".env.local".to_owned(),
                bindings: BTreeMap::from([("value".to_owned(), "SERVICE_API_KEY".to_owned())]),
                body: None,
            },
        )
        .expect("execute");

        assert!(result.succeeded);
        assert_eq!(result.exit_code, Some(0));
        assert_eq!(fs::read_to_string(stdin_capture).expect("stdin"), canary);
        assert_eq!(
            fs::read_to_string(name_capture).expect("name"),
            "SERVICE_API_KEY"
        );
        assert!(
            !serde_json::to_string(&result)
                .expect("result")
                .contains(canary)
        );
    }

    #[cfg(unix)]
    #[test]
    fn cli_action_without_name_placeholder_can_create_a_fixed_local_output() {
        use std::os::unix::fs::PermissionsExt;

        let canary = "fake_ACTION_OUTPUT_SECRET_24";
        let project = tempfile::tempdir().expect("project");
        let env_name = [".", "env", ".local"].concat();
        fs::write(
            project.path().join(&env_name),
            format!("SERVICE_API_KEY={canary}\n"),
        )
        .expect("fixture");
        let service = ProjectService::open(project.path()).expect("service");
        service.initialize().expect("initialize");
        let app_data = tempfile::tempdir().expect("app data");
        let source = tempfile::tempdir().expect("source");
        let runner = tempfile::tempdir().expect("runner");
        let executable = runner.path().join("fake-generator");
        let output = project.path().join("generated-result.bin");
        fs::write(
            &executable,
            "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then printf '1.0.0\\n'; exit 0; fi\noutput_file=$1\ncat >/dev/null\nprintf 'fake-generated-result' > \"$output_file\"\n",
        )
        .expect("runner source");
        let mut permissions = fs::metadata(&executable).expect("metadata").permissions();
        permissions.set_mode(0o700);
        fs::set_permissions(&executable, permissions).expect("permissions");
        let manifest = ActionPackManifest {
            schema_version: 1,
            id: "local.example.fixed-output".to_owned(),
            display_name: "Fixed output".to_owned(),
            description: "Synthetic one-shot generator".to_owned(),
            pack_version: "1.0.0".to_owned(),
            action_protocol_version: "0.1.0".to_owned(),
            action: ActionDefinition::Cli {
                executable_candidates: vec![executable.to_string_lossy().into_owned()],
                version_args: vec!["--version".to_owned()],
                profiles: vec![CliActionProfile {
                    id: "fake-v1".to_owned(),
                    version_requirement: ">=1,<2".to_owned(),
                    arguments: vec![output.to_string_lossy().into_owned()],
                }],
                secret_binding: "value".to_owned(),
                secret_transport: CliSecretTransport::Stdin,
                result_policy: CliResultPolicy {
                    success: true,
                    exit_code: true,
                    duration: true,
                },
                timeout_seconds: 5,
            },
        };
        fs::write(
            source.path().join("action.json"),
            serde_json::to_vec(&manifest).expect("manifest"),
        )
        .expect("write manifest");
        install(source.path(), app_data.path(), false).expect("install");

        let result = execute(
            &service,
            app_data.path(),
            ActionExecutionRequest {
                pack_id: manifest.id,
                file: env_name,
                bindings: BTreeMap::from([("value".to_owned(), "SERVICE_API_KEY".to_owned())]),
                body: None,
            },
        )
        .expect("execute");

        assert!(result.succeeded);
        assert_eq!(
            fs::read_to_string(output).expect("generated output"),
            "fake-generated-result"
        );
        assert!(
            !serde_json::to_string(&result)
                .expect("result")
                .contains(canary)
        );
    }

    fn http_v2_manifest(address: std::net::SocketAddr, canary: &str) -> ActionPackManifest {
        let _ = canary;
        ActionPackManifest {
            schema_version: 1,
            id: "local.example.chat-gateway".to_owned(),
            display_name: "Chat gateway".to_owned(),
            description: "Synthetic credential-bound API call".to_owned(),
            pack_version: "1.0.0".to_owned(),
            action_protocol_version: "0.2.0".to_owned(),
            action: ActionDefinition::Http {
                method: HttpActionMethod::Post,
                url: format!("http://{address}/v1/chat"),
                secret_bindings: BTreeMap::from([(
                    "Authorization".to_owned(),
                    HttpSecretBinding {
                        source: HttpSecretSource::Header,
                        name: None,
                        format: "Bearer {value}".to_owned(),
                    },
                )]),
                request_body: Some(HttpRequestBodyPolicy {
                    content_type: HttpBodyContentType::Json,
                    fields: vec!["model".to_owned(), "messages".to_owned()],
                }),
                response_projection: Some(HttpResponseProjection {
                    content_type: HttpBodyContentType::Json,
                    fields: BTreeMap::from([
                        ("content".to_owned(), "choices.0.message.content".to_owned()),
                        ("echo".to_owned(), "echo".to_owned()),
                    ]),
                    max_bytes: 4096,
                }),
                result_policy: HttpResultPolicy {
                    status: true,
                    duration: true,
                    body: false,
                    success_status_codes: vec![200],
                },
                timeout_seconds: 5,
            },
        }
    }

    fn install_v2(
        manifest: &ActionPackManifest,
    ) -> (ProjectService, tempfile::TempDir, tempfile::TempDir) {
        let project = tempfile::tempdir().expect("project");
        std::fs::write(
            project.path().join(".env.local"),
            "SERVICE_API_KEY=fake_ACTION_V2_SECRET_77\n",
        )
        .expect("fixture");
        let service = ProjectService::open(project.path()).expect("service");
        service.initialize().expect("initialize");
        let app_data = tempfile::tempdir().expect("app data");
        let source = tempfile::tempdir().expect("source");
        std::fs::write(
            source.path().join("action.json"),
            serde_json::to_vec(manifest).expect("manifest"),
        )
        .expect("write manifest");
        install(source.path(), app_data.path(), false).expect("install");
        (service, app_data, project)
    }

    #[test]
    fn http_action_projects_allowlisted_response_and_scrubs_echoed_secret() {
        let canary = "fake_ACTION_V2_SECRET_77";
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let address = listener.local_addr().expect("address");
        let server = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().expect("accept");
            let mut request = [0_u8; 8192];
            let size = stream.read(&mut request).expect("read request");
            let request = String::from_utf8_lossy(&request[..size]).to_string();
            assert!(request.contains("\"model\":\"fake/model\""));
            assert!(
                request
                    .to_ascii_lowercase()
                    .contains("authorization: bearer")
            );
            let body = format!(
                "{{\"choices\":[{{\"message\":{{\"content\":\"hello from model\"}}}}],\"echo\":\"{canary}\"}}"
            );
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                body.len(),
                body
            )
            .expect("response");
        });

        let (service, app_data, _project) = install_v2(&http_v2_manifest(address, canary));
        let result = execute(
            &service,
            app_data.path(),
            ActionExecutionRequest {
                pack_id: "local.example.chat-gateway".to_owned(),
                file: ".env.local".to_owned(),
                bindings: BTreeMap::from([(
                    "Authorization".to_owned(),
                    "SERVICE_API_KEY".to_owned(),
                )]),
                body: Some(
                    "{\"model\":\"fake/model\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"
                        .to_owned(),
                ),
            },
        )
        .expect("execute");
        server.join().expect("server");

        let output = result.output.as_ref().expect("projected output");
        assert_eq!(
            output.get("content").map(String::as_str),
            Some("hello from model")
        );
        assert_eq!(output.get("echo").map(String::as_str), Some("[redacted]"));
        assert!(
            !serde_json::to_string(&result)
                .expect("result")
                .contains(canary)
        );
    }

    #[test]
    fn http_action_rejects_unknown_body_fields() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let address = listener.local_addr().expect("address");
        drop(listener);
        let (service, app_data, _project) = install_v2(&http_v2_manifest(address, "unused"));
        let error = execute(
            &service,
            app_data.path(),
            ActionExecutionRequest {
                pack_id: "local.example.chat-gateway".to_owned(),
                file: ".env.local".to_owned(),
                bindings: BTreeMap::from([(
                    "Authorization".to_owned(),
                    "SERVICE_API_KEY".to_owned(),
                )]),
                body: Some("{\"model\":\"fake/model\",\"evil\":true}".to_owned()),
            },
        )
        .expect_err("rejected");
        assert_eq!(error.code, "ACTION_REQUEST_INVALID");
    }

    #[test]
    fn v1_http_action_rejects_a_request_body() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
        let address = listener.local_addr().expect("address");
        drop(listener);
        let project = tempfile::tempdir().expect("project");
        std::fs::write(
            project.path().join(".env.local"),
            "SERVICE_API_KEY=fake_ACTION_V1_SECRET_11\n",
        )
        .expect("fixture");
        let service = ProjectService::open(project.path()).expect("service");
        service.initialize().expect("initialize");
        let app_data = tempfile::tempdir().expect("app data");
        let source = tempfile::tempdir().expect("source");
        let manifest = ActionPackManifest {
            schema_version: 1,
            id: "local.example.v1-check".to_owned(),
            display_name: "V1 check".to_owned(),
            description: "Synthetic v1 action".to_owned(),
            pack_version: "1.0.0".to_owned(),
            action_protocol_version: "0.1.0".to_owned(),
            action: ActionDefinition::Http {
                method: HttpActionMethod::Post,
                url: format!("http://{address}/v1/check"),
                secret_bindings: BTreeMap::from([(
                    "Authorization".to_owned(),
                    HttpSecretBinding {
                        source: HttpSecretSource::Header,
                        name: None,
                        format: "Bearer {value}".to_owned(),
                    },
                )]),
                request_body: None,
                response_projection: None,
                result_policy: HttpResultPolicy {
                    status: true,
                    duration: true,
                    body: false,
                    success_status_codes: vec![200],
                },
                timeout_seconds: 5,
            },
        };
        std::fs::write(
            source.path().join("action.json"),
            serde_json::to_vec(&manifest).expect("manifest"),
        )
        .expect("write manifest");
        install(source.path(), app_data.path(), false).expect("install");
        let error = execute(
            &service,
            app_data.path(),
            ActionExecutionRequest {
                pack_id: "local.example.v1-check".to_owned(),
                file: ".env.local".to_owned(),
                bindings: BTreeMap::from([(
                    "Authorization".to_owned(),
                    "SERVICE_API_KEY".to_owned(),
                )]),
                body: Some("{\"model\":\"fake/model\"}".to_owned()),
            },
        )
        .expect_err("rejected");
        assert_eq!(error.code, "ACTION_REQUEST_INVALID");
    }
}
