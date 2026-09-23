use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use env_core::{
    SecretInputOutcome, SecretInputRequest, SecretInputResponse, SecretInputResult,
    secret_input_socket_path,
};
use tauri::{AppHandle, Emitter, Manager};

/// Tracks in-flight human secret-input requests triggered by the local broker.
#[derive(Default)]
pub struct SecretInputState {
    pending: Mutex<HashMap<String, Pending>>,
}

struct Pending {
    names: Vec<String>,
    sender: std::sync::mpsc::Sender<Vec<SecretInputResult>>,
}

impl SecretInputState {
    fn register(
        &self,
        request_id: String,
        names: Vec<String>,
    ) -> std::sync::mpsc::Receiver<Vec<SecretInputResult>> {
        let (sender, receiver) = std::sync::mpsc::channel();
        self.pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .insert(request_id, Pending { names, sender });
        receiver
    }

    fn take(&self, request_id: &str) -> Option<Pending> {
        self.pending
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .remove(request_id)
    }

    /// Resolves a pending request with per-name outcomes. Returns false when the
    /// request already expired or was cancelled.
    pub fn resolve(&self, request_id: &str, results: Vec<SecretInputResult>) -> bool {
        match self.take(request_id) {
            Some(pending) => pending.sender.send(results).is_ok(),
            None => false,
        }
    }

    pub fn cancel(&self, request_id: &str, outcome: SecretInputOutcome) -> bool {
        match self.take(request_id) {
            Some(pending) => {
                let results = pending
                    .names
                    .iter()
                    .map(|name| SecretInputResult {
                        name: name.clone(),
                        outcome,
                    })
                    .collect();
                pending.sender.send(results).is_ok()
            }
            None => false,
        }
    }
}

#[cfg(unix)]
pub fn start(app: AppHandle, app_data: std::path::PathBuf) {
    std::thread::spawn(move || {
        use std::os::unix::net::UnixListener;

        let path = secret_input_socket_path(&app_data);
        let _ = std::fs::remove_file(&path);
        let Ok(listener) = UnixListener::bind(&path) else {
            return;
        };
        for stream in listener.incoming().flatten() {
            let app = app.clone();
            std::thread::spawn(move || handle_connection(&app, stream));
        }
    });
}

#[cfg(not(unix))]
pub fn start(_app: AppHandle, _app_data: std::path::PathBuf) {}

#[cfg(unix)]
fn handle_connection(app: &AppHandle, stream: std::os::unix::net::UnixStream) {
    use std::io::{BufRead, BufReader, Write};

    let Ok(reader_stream) = stream.try_clone() else {
        return;
    };
    let mut reader = BufReader::new(reader_stream);
    let mut line = String::new();
    if reader.read_line(&mut line).is_err() {
        return;
    }
    let Ok(request) = serde_json::from_str::<SecretInputRequest>(line.trim()) else {
        return;
    };
    let names = request
        .entries
        .iter()
        .map(|entry| entry.name.clone())
        .collect::<Vec<_>>();
    let receiver = app
        .state::<SecretInputState>()
        .register(request.request_id.clone(), names.clone());
    let _ = app.emit("secret-input-request", &request);

    let response = match receiver.recv_timeout(Duration::from_secs(request.timeout_seconds)) {
        Ok(results) => SecretInputResponse {
            request_id: request.request_id.clone(),
            results,
        },
        Err(_) => {
            app.state::<SecretInputState>().take(&request.request_id);
            SecretInputResponse::all(&request.request_id, &names, SecretInputOutcome::Timeout)
        }
    };

    let mut stream = stream;
    if serde_json::to_writer(&mut stream, &response).is_ok() {
        let _ = stream.write_all(b"\n");
        let _ = stream.flush();
    }
}
