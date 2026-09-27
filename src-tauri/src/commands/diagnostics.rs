use std::time::{SystemTime, UNIX_EPOCH};

use env_core::{
    DIAGNOSTICS_SCHEMA_VERSION, ProjectDiagnostic, project_diagnostic_for, render_diagnostics_json,
};
use serde::Serialize;

use super::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BuildDiagnosticsRequest {
    destination: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticsResult {
    destination: String,
    project_count: usize,
    failed_project_count: usize,
    variable_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppDiagnostic {
    version: &'static str,
    os: &'static str,
    arch: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentIntegrationDiagnostic {
    id: AgentIntegrationId,
    detected: bool,
    installed: bool,
    installed_version: Option<String>,
    current_version: String,
    update_available: bool,
    needs_repair: bool,
    protection: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsReport {
    schema_version: u32,
    generated_at_ms: u64,
    note: &'static str,
    app: AppDiagnostic,
    agent_bundle_version: String,
    agent_integrations: Vec<AgentIntegrationDiagnostic>,
    projects: Vec<ProjectDiagnostic>,
}

/// Writes a value-free diagnostics report for every registered project.
///
/// The report is assembled from an allowlist in `env-core` and written by Rust, so
/// the frontend never holds the report body. No value and no absolute path can
/// reach the file: the allowlist has no field able to carry either.
#[tauri::command]
pub fn build_diagnostics_report(
    request: BuildDiagnosticsRequest,
    app: AppHandle,
    runtime: State<'_, AppRuntime>,
) -> CommandResult<DiagnosticsResult> {
    let destination = std::path::PathBuf::from(&request.destination);
    if destination
        .extension()
        .is_none_or(|extension| extension != "json")
    {
        return Err(CommandError {
            code: "DIAGNOSTICS_DESTINATION_INVALID".to_owned(),
            message: "진단 리포트는 .json 파일로 저장해야 합니다.".to_owned(),
        });
    }

    let mut projects = Vec::new();
    for summary in runtime.list() {
        let root = runtime
            .root(&summary.id)
            .unwrap_or_else(|_| std::path::PathBuf::from(&summary.display_path));
        projects.push(project_diagnostic_for(&root));
    }

    let failed_project_count = projects
        .iter()
        .filter(|project| project.load_error.is_some())
        .count();
    let variable_count = projects.iter().map(|project| project.variables.len()).sum();

    let report = DiagnosticsReport {
        schema_version: DIAGNOSTICS_SCHEMA_VERSION,
        generated_at_ms: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |elapsed| {
                elapsed.as_millis().min(u128::from(u64::MAX)) as u64
            }),
        note: "Value-free diagnostics. Contains no env values and no absolute paths. \
               Safe to attach to a public bug report.",
        app: AppDiagnostic {
            version: env!("CARGO_PKG_VERSION"),
            os: std::env::consts::OS,
            arch: std::env::consts::ARCH,
        },
        agent_bundle_version: crate::integrations::agent_bundle_version().to_owned(),
        agent_integrations: crate::integrations::list(&app)
            .into_iter()
            .map(|status| AgentIntegrationDiagnostic {
                id: status.id,
                detected: status.detected,
                installed: status.installed,
                installed_version: status.installed_version.clone(),
                current_version: status.current_version.to_owned(),
                update_available: status.update_available,
                needs_repair: status.needs_repair,
                protection: status.protection.to_owned(),
            })
            .collect(),
        projects,
    };

    let rendered = render_diagnostics_json(&report)?;
    std::fs::write(&destination, rendered).map_err(|error| CommandError {
        code: "DIAGNOSTICS_WRITE_FAILED".to_owned(),
        message: format!("진단 리포트를 저장하지 못했습니다: {}", error.kind()),
    })?;

    Ok(DiagnosticsResult {
        destination: destination.to_string_lossy().into_owned(),
        project_count: report.projects.len(),
        failed_project_count,
        variable_count,
    })
}
