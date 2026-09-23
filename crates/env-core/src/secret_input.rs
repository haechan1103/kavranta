use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::CodexAccess;

/// Local socket the desktop app listens on for human secret-input requests.
pub const SECRET_INPUT_SOCKET_FILE: &str = "secret-input.sock";

pub fn secret_input_socket_path(app_data: &Path) -> PathBuf {
    app_data.join(SECRET_INPUT_SOCKET_FILE)
}

/// One requested value. The name and placement are metadata; the value never
/// travels over the socket.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SecretInputEntry {
    pub name: String,
    pub file: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub group: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub classification: Option<CodexAccess>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SecretInputRequest {
    pub request_id: String,
    pub project_root: String,
    pub timeout_seconds: u64,
    pub entries: Vec<SecretInputEntry>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum SecretInputOutcome {
    Added,
    Updated,
    Skipped,
    Cancelled,
    Timeout,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SecretInputResult {
    pub name: String,
    pub outcome: SecretInputOutcome,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SecretInputResponse {
    pub request_id: String,
    pub results: Vec<SecretInputResult>,
}

impl SecretInputResponse {
    pub fn all(request_id: &str, names: &[String], outcome: SecretInputOutcome) -> Self {
        Self {
            request_id: request_id.to_owned(),
            results: names
                .iter()
                .map(|name| SecretInputResult {
                    name: name.clone(),
                    outcome,
                })
                .collect(),
        }
    }
}
