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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct GuideAttachmentRequest {
    project_id: String,
    key: String,
    file: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GuideAttachmentContent {
    mime_type: String,
    base64: String,
}

#[tauri::command]
pub fn read_guide_attachment(
    request: GuideAttachmentRequest,
    runtime: State<'_, AppRuntime>,
) -> CommandResult<Option<GuideAttachmentContent>> {
    let service = runtime.service(&request.project_id)?;
    Ok(service
        .guide_attachment(&request.key, &request.file)?
        .map(|attachment| GuideAttachmentContent {
            mime_type: attachment.mime_type,
            base64: attachment.base64,
        }))
}

#[tauri::command]
pub fn remove_variable_guide(
    request: VariableGuideRequest,
    runtime: State<'_, AppRuntime>,
) -> CommandResult<MutationSummary> {
    let service = runtime.service(&request.project_id)?;
    Ok(service.remove_variable_guide(&request.key)?)
}
