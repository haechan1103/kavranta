use std::collections::BTreeMap;

use serde::Serialize;

use crate::model::{ProjectProjection, RedactedValueState};
use crate::{EnvResult, GitSafetyState, ProjectService};

pub const DIAGNOSTICS_SCHEMA_VERSION: u32 = 1;

/// Value-free counts of a project's Git exposure state. Paths are reduced to
/// counts because a report is meant to be attached to a public issue.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDiagnosticCounts {
    pub state: GitSafetyState,
    pub ignored: usize,
    pub missing_ignore: usize,
    pub tracked: usize,
    pub in_history: usize,
    pub in_remote_history: usize,
}

/// One occurrence reduced to the fields a bug report needs.
///
/// This type deliberately has no field able to hold a value. It is built from the
/// redacted projection instead of copying it, so a future change to the projection
/// can never leak a value into a report.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VariableDiagnostic {
    pub name: String,
    pub present: bool,
    pub access: String,
    pub linked_files: usize,
    pub duplicate: bool,
    pub has_guide: bool,
}

/// One project reduced to structure, policy, and counts. Never a value, never a
/// filesystem path.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDiagnostic {
    pub name: String,
    /// File names only, such as `.env.local`. Never the folder that contains them.
    pub file_names: Vec<String>,
    pub variables: Vec<VariableDiagnostic>,
    pub parser_issue_count: usize,
    pub unclassified_count: usize,
    pub git: GitDiagnosticCounts,
    /// Why the project could not be scanned, already path-redacted. `None` when
    /// the project loaded.
    pub load_error: Option<String>,
}

/// Builds the value-free diagnostic for one project.
///
/// `load_error` is supplied by the caller because only the caller knows why a
/// project failed to open; the message is expected to be value-free.
pub fn project_diagnostic(
    projection: &ProjectProjection,
    load_error: Option<String>,
) -> ProjectDiagnostic {
    let mut file_names = projection
        .files
        .iter()
        // `display_name` is user-facing and may still carry a nested folder such as
        // `apps/web/.env`, so reduce it to the bare file name.
        .map(|file| {
            file.display_name
                .rsplit('/')
                .next()
                .unwrap_or(&file.display_name)
                .to_owned()
        })
        .collect::<Vec<_>>();
    file_names.sort();
    file_names.dedup();

    let mut variables = Vec::new();
    for file in &projection.files {
        for group in &file.groups {
            for variable in &group.variables {
                variables.push(VariableDiagnostic {
                    name: variable.key.clone(),
                    present: variable.value_state == RedactedValueState::Present,
                    access: format!("{:?}", variable.codex_access).to_lowercase(),
                    linked_files: variable.linked_files.len(),
                    duplicate: variable.duplicate,
                    has_guide: variable.has_guide,
                });
            }
        }
    }
    variables.sort_by(|left, right| left.name.cmp(&right.name));
    variables.dedup_by(|left, right| left.name == right.name);

    ProjectDiagnostic {
        name: projection.name.clone(),
        file_names,
        variables,
        parser_issue_count: projection.issue_count,
        unclassified_count: projection.unclassified_count,
        git: GitDiagnosticCounts {
            state: projection.git_safety.state,
            ignored: projection.git_safety.ignored_files.len(),
            missing_ignore: projection.git_safety.missing_ignore_files.len(),
            tracked: projection.git_safety.tracked_files.len(),
            in_history: projection.git_safety.history_files.len(),
            in_remote_history: projection.git_safety.remote_history_files.len(),
        },
        load_error: load_error.map(|error| redact_diagnostic_text(&error)),
    }
}

/// Builds a diagnostic by scanning the project, or recording why it could not be
/// scanned. A failing project never removes the others.
pub fn project_diagnostic_for(root: &std::path::Path) -> ProjectDiagnostic {
    let display_name = root
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "project".to_owned());
    match ProjectService::open(root).and_then(|service| service.scan()) {
        Ok(projection) => project_diagnostic(&projection, None),
        Err(error) => ProjectDiagnostic {
            name: display_name,
            file_names: Vec::new(),
            variables: Vec::new(),
            parser_issue_count: 0,
            unclassified_count: 0,
            git: GitDiagnosticCounts {
                state: GitSafetyState::Unavailable,
                ignored: 0,
                missing_ignore: 0,
                tracked: 0,
                in_history: 0,
                in_remote_history: 0,
            },
            load_error: Some(redact_diagnostic_text(&error.to_string())),
        },
    }
}

/// Replaces anything path-like with `<path>`, so a report never carries the user's
/// folder layout. Handles POSIX, `~/`, Windows drive letters, and backslash paths.
fn redact_diagnostic_text(text: &str) -> String {
    let mut output = String::with_capacity(text.len());
    for (index, token) in text.split_whitespace().enumerate() {
        if index > 0 {
            output.push(' ');
        }
        if is_path_like(token) {
            output.push_str("<path>");
        } else {
            output.push_str(token);
        }
    }
    output
}

fn is_path_like(token: &str) -> bool {
    if token.starts_with('/') || token.starts_with('~') {
        return true;
    }
    // Windows drive letter such as `C:\Users` or `C:/Users`.
    let bytes = token.as_bytes();
    if bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && matches!(bytes[2], b'\\' | b'/')
    {
        return true;
    }
    token.contains('\\')
}

/// Aggregates per-key counts for a compact summary line.
pub fn variable_summary(variables: &[VariableDiagnostic]) -> BTreeMap<&'static str, usize> {
    let mut summary = BTreeMap::new();
    summary.insert("total", variables.len());
    summary.insert(
        "present",
        variables.iter().filter(|variable| variable.present).count(),
    );
    summary.insert(
        "withGuide",
        variables
            .iter()
            .filter(|variable| variable.has_guide)
            .count(),
    );
    summary
}

/// Serializes the report body with a trailing newline, refusing to emit anything
/// that a caller could have smuggled in.
pub fn render_diagnostics_json<T: Serialize>(report: &T) -> EnvResult<String> {
    let mut bytes = serde_json::to_vec_pretty(report).map_err(crate::EnvError::serialization)?;
    bytes.push(b'\n');
    String::from_utf8(bytes)
        .map_err(|_| crate::EnvError::invalid("진단 리포트를 UTF-8로 만들지 못했습니다."))
}
