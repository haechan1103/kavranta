use super::*;
use env_core::ExposureProjection;

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
