use env_test_support::{FAKE_SECRET_CANARY, SyntheticProject};

use super::super::*;
use crate::exposure::{ExposureDisposition, ExposureKind};

#[test]
fn exposure_scan_reports_names_paths_and_counts_without_values() {
    let project = SyntheticProject::new();
    project.write(
        ".env.local",
        &format!("GPT_API_KEY={FAKE_SECRET_CANARY}\nPORT=fake_3000\n"),
    );
    project.write(
        "credentials.json",
        "{\"client_email\":\"fake_demo@example.com\",\"private_key\":\"fake_key\"}\n",
    );
    project.write(
        ".env.example",
        &format!("GPT_API_KEY={FAKE_SECRET_CANARY}\n"),
    );
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");

    let projection = service.exposure_scan(false).expect("scan");

    assert_eq!(projection.counts.managed, 1);
    assert_eq!(projection.counts.certain, 1);
    assert!(
        projection
            .findings
            .iter()
            .any(|finding| finding.path == ".env.local" && finding.kind == ExposureKind::EnvFile)
    );
    assert!(
        projection
            .findings
            .iter()
            .any(|finding| finding.path == "credentials.json"
                && finding.kind == ExposureKind::CredentialFile
                && finding.disposition == ExposureDisposition::Exposed)
    );
    let serialized = serde_json::to_string(&projection).expect("projection");
    assert!(!serialized.contains(FAKE_SECRET_CANARY));
}

#[test]
fn exposure_scan_marks_ai_allowed_variables_and_user_allowed_paths() {
    let project = SyntheticProject::new();
    project.write(".env.local", "PORT=fake_3000\nGPT_API_KEY=fake_secret\n");
    project.write(
        "credentials.json",
        "{\"client_email\":\"fake_demo@example.com\"}\n",
    );
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");

    let store = ManifestStore::for_root(project.root());
    let mut manifest = store.load().expect("manifest");
    manifest.variables.insert(
        "GPT_API_KEY".to_owned(),
        VariablePolicy {
            codex_access: CodexAccess::ReadWrite,
            classified_by: ClassificationSource::User,
        },
    );
    manifest.exposure.allowed_paths = vec!["credentials.json".to_owned()];
    store.save(&manifest).expect("save manifest");

    let projection = service.exposure_scan(false).expect("scan");

    let env = projection
        .findings
        .iter()
        .find(|finding| finding.path == ".env.local")
        .expect("env finding");
    assert_eq!(env.disposition, ExposureDisposition::Allowed);
    assert_eq!(env.reason.as_deref(), Some("ai-allowed-variable"));

    let credentials = projection
        .findings
        .iter()
        .find(|finding| finding.path == "credentials.json")
        .expect("credentials finding");
    assert_eq!(credentials.disposition, ExposureDisposition::Allowed);
    assert_eq!(credentials.reason.as_deref(), Some("user-allowed-path"));

    assert_eq!(projection.counts.allowed, 2);
    assert_eq!(projection.counts.managed, 0);
    assert_eq!(projection.counts.certain, 0);
}
