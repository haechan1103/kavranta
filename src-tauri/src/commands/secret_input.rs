use env_core::{
    CreateEnvFileRequest, EnvResult, ProjectService, SecretInputOutcome, SecretInputResult,
    is_env_candidate,
};

use crate::runtime::SecretInputState;

use super::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SubmitSecretInputEntry {
    name: String,
    file: String,
    #[serde(default)]
    group: Option<String>,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    classification: Option<CodexAccess>,
    value: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SubmitSecretInputRequest {
    request_id: String,
    project_root: String,
    entries: Vec<SubmitSecretInputEntry>,
}

#[tauri::command]
pub fn submit_secret_input(
    request: SubmitSecretInputRequest,
    state: State<'_, SecretInputState>,
) -> CommandResult<()> {
    let service = ProjectService::open(&request.project_root)?;
    let results = request
        .entries
        .into_iter()
        .map(|entry| write_entry(&service, entry))
        .collect();
    state.resolve(&request.request_id, results);
    Ok(())
}

#[tauri::command]
pub fn cancel_secret_input(
    request_id: String,
    state: State<'_, SecretInputState>,
) -> CommandResult<()> {
    state.cancel(&request_id, SecretInputOutcome::Cancelled);
    Ok(())
}

fn write_entry(service: &ProjectService, entry: SubmitSecretInputEntry) -> SecretInputResult {
    let name = entry.name.clone();
    let outcome = write_value(service, &entry).unwrap_or(SecretInputOutcome::Failed);
    SecretInputResult { name, outcome }
}

fn write_value(
    service: &ProjectService,
    entry: &SubmitSecretInputEntry,
) -> EnvResult<SecretInputOutcome> {
    if entry.value.is_empty() {
        return Ok(SecretInputOutcome::Skipped);
    }
    if !is_env_candidate(&entry.file) {
        return Err(EnvError::invalid("지원하지 않는 env 파일 경로입니다."));
    }
    if !service.root().join(&entry.file).exists() {
        let _ = service.create_env_file(CreateEnvFileRequest {
            file: entry.file.clone(),
        });
    }
    let outcome = match service.add_variable(AddVariableRequest {
        file: entry.file.clone(),
        key: entry.name.clone(),
        group: entry.group.clone().unwrap_or_default(),
        description: entry
            .description
            .clone()
            .map(|line| vec![line])
            .unwrap_or_default(),
        value: entry.value.clone(),
    }) {
        Ok(_) => SecretInputOutcome::Added,
        Err(_) => service
            .save_value(SaveValueRequest {
                file: entry.file.clone(),
                key: entry.name.clone(),
                new_value: entry.value.clone(),
            })
            .map(|_| SecretInputOutcome::Updated)?,
    };
    if let Some(access) = entry.classification {
        let _ = service.set_codex_access(&entry.name, access);
    }
    Ok(outcome)
}
