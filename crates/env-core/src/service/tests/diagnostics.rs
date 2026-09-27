use std::fs;

use env_test_support::SyntheticProject;

use super::super::*;
use crate::{
    ProjectDiagnostic, project_diagnostic, project_diagnostic_for, render_diagnostics_json,
    variable_summary,
};

const CANARY: &str = "fake_canary_diagnostic_value";

#[test]
fn diagnostics_report_never_contains_a_canary_or_a_folder_path() {
    let project = SyntheticProject::new();
    project.write(
        ".env.local",
        &format!("GEMINI_API_KEY={CANARY}\nDATABASE_URL=fake_postgres\n"),
    );
    project.write("src/credentials.json", "fake_content");
    let service = ProjectService::open(project.root()).expect("service");
    let projection = service.scan().expect("scan");

    let diagnostic = project_diagnostic(&projection, None);
    let rendered = render_diagnostics_json(&diagnostic).expect("render");

    assert!(!rendered.contains(CANARY), "report leaked a value");
    assert!(
        !rendered.contains("fake_postgres"),
        "report leaked a second value"
    );
    assert!(
        !rendered.contains(&project.root().to_string_lossy().to_string()),
        "report leaked the project folder path"
    );
    // Structure a maintainer needs is still present.
    assert!(rendered.contains("GEMINI_API_KEY"));
    assert!(rendered.contains("DATABASE_URL"));
    assert!(rendered.contains(".env.local"));
}

#[test]
fn diagnostics_report_keeps_a_failed_project_without_dropping_the_others() {
    let project = SyntheticProject::new();
    project.write(".env.local", "PORT=fake_3000\n");

    let healthy = project_diagnostic_for(project.root());
    assert!(healthy.load_error.is_none());
    assert!(healthy.variables.iter().any(|item| item.name == "PORT"));

    let directory = tempfile::tempdir().expect("temp dir");
    let broken = project_diagnostic_for(directory.path().join("missing").as_path());
    assert!(broken.load_error.is_some());
    assert!(broken.variables.is_empty());
    assert!(broken.file_names.is_empty());
}

#[test]
fn diagnostics_load_error_redacts_absolute_paths() {
    let directory = tempfile::tempdir().expect("temp dir");
    let report = project_diagnostic_for(&directory.path().join("gone"));
    let message = report.load_error.expect("load error");
    assert!(!message.contains(&directory.path().to_string_lossy().to_string()));
    // The guarantee holds on every platform: no separator survives redaction.
    assert!(
        !message.contains('/') && !message.contains('\\'),
        "message kept a path separator: {message}"
    );
}

#[test]
fn diagnostics_files_are_named_without_their_folder() {
    let project = SyntheticProject::new();
    project.write(".env.local", "PORT=fake_3000\n");
    project.write("apps/web/.env", "VITE_X=fake_one\n");
    let service = ProjectService::open(project.root()).expect("service");
    let diagnostic = project_diagnostic(&service.scan().expect("scan"), None);

    assert!(diagnostic.file_names.contains(&".env.local".to_owned()));
    // Nested file keeps only its name so the folder layout is not reported.
    assert!(
        diagnostic
            .file_names
            .iter()
            .all(|name| !name.contains('/') && !name.contains('\\')),
        "file names leaked folders: {:?}",
        diagnostic.file_names
    );
}

#[test]
fn diagnostics_summary_counts_are_derived_from_the_allowlist() {
    let project = SyntheticProject::new();
    project.write(".env.local", "A=fake_one\nB=\n");
    let service = ProjectService::open(project.root()).expect("service");
    let diagnostic = project_diagnostic(&service.scan().expect("scan"), None);
    let summary = variable_summary(&diagnostic.variables);

    assert_eq!(summary.get("total"), Some(&2));
    assert_eq!(summary.get("present"), Some(&1));
    // The report file the user attaches must itself be a plain, parseable JSON
    // document, not a dump that needs a custom reader.
    let written = directory_written_json(&diagnostic);
    assert!(written.starts_with('{'));
}

fn directory_written_json(diagnostic: &ProjectDiagnostic) -> String {
    let directory = tempfile::tempdir().expect("temp dir");
    let path = directory.path().join("report.json");
    let rendered = render_diagnostics_json(diagnostic).expect("render");
    fs::write(&path, &rendered).expect("write");
    fs::read_to_string(&path).expect("read")
}
