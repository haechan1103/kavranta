use super::*;
use env_core::{ExposureProjection, RedactionProof};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposureScanRequest {
    project_id: String,
    #[serde(default)]
    deep: bool,
}

#[tauri::command]
pub fn scan_exposure(
    request: ExposureScanRequest,
    runtime: State<'_, AppRuntime>,
) -> CommandResult<ExposureProjection> {
    let service = runtime.service(&request.project_id)?;
    Ok(service.exposure_scan(request.deep)?)
}

/// Proves redaction at runtime with synthetic canaries in an isolated
/// temporary project. Touches no registry, audit log, or real project.
#[tauri::command]
pub fn run_redaction_self_check() -> CommandResult<RedactionProof> {
    Ok(env_core::run_redaction_self_check()?)
}
