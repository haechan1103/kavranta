use super::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct VariableGuideRequest {
    project_id: String,
    key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SaveVariableGuideRequest {
    project_id: String,
    key: String,
    markdown: String,
}

#[tauri::command]
pub fn read_variable_guide(
    request: VariableGuideRequest,
    runtime: State<'_, AppRuntime>,
) -> CommandResult<Option<String>> {
    let service = runtime.service(&request.project_id)?;
    Ok(service.variable_guide(&request.key)?)
}

#[tauri::command]
pub fn save_variable_guide(
    request: SaveVariableGuideRequest,
    runtime: State<'_, AppRuntime>,
) -> CommandResult<MutationSummary> {
    let service = runtime.service(&request.project_id)?;
    Ok(service.save_variable_guide(&request.key, &request.markdown)?)
}

#[tauri::command]
pub fn remove_variable_guide(
    request: VariableGuideRequest,
    runtime: State<'_, AppRuntime>,
) -> CommandResult<MutationSummary> {
    let service = runtime.service(&request.project_id)?;
    Ok(service.remove_variable_guide(&request.key)?)
}
