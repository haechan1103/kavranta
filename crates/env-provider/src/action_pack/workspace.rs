//! Saved Action requests and run history for the desktop request view (ADR-0046).
//!
//! Everything here is local app data, outside projects and Git. A saved request holds
//! a Pack ID, an env file, binding-to-variable *names* and an optional allowlisted
//! JSON body that was checked against bound values and the secret catalog. A run
//! record holds only the allowlisted result metadata and projected output, with the
//! output passed through the secret catalog's redaction again before it is stored.

use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use env_core::ProjectService;
use serde::{Deserialize, Serialize};

use super::engine::check_saved_request;
use super::error::{ActionPackError, invalid_request, storage_failed};
use super::model::{ActionExecutionRequest, ActionExecutionResult};

const WORKSPACE_VERSION: u32 = 1;
const MAX_WORKSPACE_BYTES: u64 = 4 * 1024 * 1024;
const MAX_REQUESTS_PER_PROJECT: usize = 200;
const MAX_HISTORY_PER_PROJECT: usize = 50;
const MAX_NAME_CHARS: usize = 80;

static SEQUENCE: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SavedActionRequest {
    pub id: String,
    pub project_id: String,
    pub pack_id: String,
    pub name: String,
    pub file: String,
    pub bindings: BTreeMap<String, String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<String>,
    pub updated_at: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveActionRequestInput {
    /// Present to overwrite an existing saved request of the same project.
    #[serde(default)]
    pub id: Option<String>,
    pub name: String,
    pub request: ActionExecutionRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ActionRunRecord {
    pub id: String,
    pub project_id: String,
    pub pack_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub request_name: Option<String>,
    pub at: u64,
    pub succeeded: bool,
    pub status_code: Option<u16>,
    pub duration_ms: Option<u64>,
    pub exit_code: Option<i32>,
    pub result_code: String,
    #[serde(default)]
    pub output: BTreeMap<String, String>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct WorkspaceFile {
    version: u32,
    #[serde(default)]
    requests: Vec<SavedActionRequest>,
    #[serde(default)]
    history: Vec<ActionRunRecord>,
}

pub fn list_requests(app_data: &Path, project_id: &str) -> Vec<SavedActionRequest> {
    let mut requests = read_workspace(app_data)
        .requests
        .into_iter()
        .filter(|request| request.project_id == project_id)
        .collect::<Vec<_>>();
    requests.sort_by_key(|request| request.name.to_lowercase());
    requests
}

pub fn save_request(
    service: &ProjectService,
    app_data: &Path,
    project_id: &str,
    input: SaveActionRequestInput,
) -> Result<SavedActionRequest, ActionPackError> {
    let name = input.name.trim();
    if name.is_empty()
        || name.chars().count() > MAX_NAME_CHARS
        || name.chars().any(char::is_control)
    {
        return Err(invalid_request());
    }
    check_saved_request(service, app_data, &input.request)?;

    let mut workspace = read_workspace(app_data);
    let now = now_millis();
    let existing = input.id.as_deref().and_then(|id| {
        workspace
            .requests
            .iter_mut()
            .find(|request| request.id == id && request.project_id == project_id)
    });
    let saved = SavedActionRequest {
        id: existing
            .as_ref()
            .map_or_else(|| new_id(now), |request| request.id.clone()),
        project_id: project_id.to_owned(),
        pack_id: input.request.pack_id,
        name: name.to_owned(),
        file: input.request.file,
        bindings: input.request.bindings,
        body: input.request.body,
        updated_at: now,
    };
    if let Some(slot) = existing {
        *slot = saved.clone();
    } else {
        let count = workspace
            .requests
            .iter()
            .filter(|request| request.project_id == project_id)
            .count();
        if count >= MAX_REQUESTS_PER_PROJECT {
            return Err(ActionPackError::new(
                "ACTION_REQUESTS_FULL",
                "저장할 수 있는 요청 수를 넘었습니다. 쓰지 않는 요청을 지워주세요.",
            ));
        }
        workspace.requests.push(saved.clone());
    }
    write_workspace(app_data, &workspace)?;
    Ok(saved)
}

pub fn delete_request(app_data: &Path, project_id: &str, id: &str) -> Result<(), ActionPackError> {
    let mut workspace = read_workspace(app_data);
    workspace
        .requests
        .retain(|request| !(request.id == id && request.project_id == project_id));
    write_workspace(app_data, &workspace)
}

pub fn list_history(app_data: &Path, project_id: &str) -> Vec<ActionRunRecord> {
    let mut history = read_workspace(app_data)
        .history
        .into_iter()
        .filter(|record| record.project_id == project_id)
        .collect::<Vec<_>>();
    history.sort_by_key(|record| std::cmp::Reverse(record.at));
    history
}

/// Records one desktop run. The output was already projected and scrubbed against the
/// bound values by the engine; it is redacted against the secret catalog once more.
pub fn record_run(
    app_data: &Path,
    project_id: &str,
    request_name: Option<&str>,
    result: &ActionExecutionResult,
) -> Result<ActionRunRecord, ActionPackError> {
    let now = now_millis();
    let record = ActionRunRecord {
        id: new_id(now),
        project_id: project_id.to_owned(),
        pack_id: result.pack_id.clone(),
        request_name: request_name
            .map(str::trim)
            .filter(|name| !name.is_empty())
            .map(|name| name.chars().take(MAX_NAME_CHARS).collect()),
        at: now,
        succeeded: result.succeeded,
        status_code: result.status_code,
        duration_ms: result.duration_ms,
        exit_code: result.exit_code,
        result_code: result.result_code.clone(),
        output: result
            .output
            .iter()
            .flatten()
            .map(|(key, value)| (key.clone(), env_core::secrets::redact(value)))
            .collect(),
    };
    let mut workspace = read_workspace(app_data);
    workspace.history.push(record.clone());
    let mut kept = 0;
    let mut history = std::mem::take(&mut workspace.history);
    history.sort_by_key(|record| std::cmp::Reverse(record.at));
    history.retain(|entry| {
        if entry.project_id != project_id {
            return true;
        }
        kept += 1;
        kept <= MAX_HISTORY_PER_PROJECT
    });
    workspace.history = history;
    write_workspace(app_data, &workspace)?;
    Ok(record)
}

pub fn clear_history(app_data: &Path, project_id: &str) -> Result<(), ActionPackError> {
    let mut workspace = read_workspace(app_data);
    workspace
        .history
        .retain(|record| record.project_id != project_id);
    write_workspace(app_data, &workspace)
}

fn workspace_path(app_data: &Path) -> PathBuf {
    app_data.join("action-packs").join("workspace.json")
}

/// A missing, oversized or unreadable file reads as empty instead of failing the dialog.
fn read_workspace(app_data: &Path) -> WorkspaceFile {
    let path = workspace_path(app_data);
    let Ok(metadata) = fs::symlink_metadata(&path) else {
        return WorkspaceFile::default();
    };
    if !metadata.is_file() || metadata.len() > MAX_WORKSPACE_BYTES {
        return WorkspaceFile::default();
    }
    fs::read(&path)
        .ok()
        .and_then(|bytes| serde_json::from_slice::<WorkspaceFile>(&bytes).ok())
        .filter(|workspace| workspace.version == WORKSPACE_VERSION)
        .unwrap_or_default()
}

fn write_workspace(app_data: &Path, workspace: &WorkspaceFile) -> Result<(), ActionPackError> {
    let path = workspace_path(app_data);
    let directory = path.parent().ok_or_else(storage_failed)?;
    fs::create_dir_all(directory).map_err(|_| storage_failed())?;
    let file = WorkspaceFile {
        version: WORKSPACE_VERSION,
        requests: workspace.requests.clone(),
        history: workspace.history.clone(),
    };
    let bytes = serde_json::to_vec_pretty(&file).map_err(|_| storage_failed())?;
    let mut staging = tempfile::NamedTempFile::new_in(directory).map_err(|_| storage_failed())?;
    staging.write_all(&bytes).map_err(|_| storage_failed())?;
    staging.as_file().sync_all().map_err(|_| storage_failed())?;
    staging.persist(&path).map_err(|_| storage_failed())?;
    Ok(())
}

fn now_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| u64::try_from(duration.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or_default()
}

fn new_id(now: u64) -> String {
    format!("{now:x}-{:x}", SEQUENCE.fetch_add(1, Ordering::Relaxed))
}
