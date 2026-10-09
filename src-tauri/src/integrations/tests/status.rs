use super::super::integration_requires_repair;

#[test]
fn an_outdated_bundle_is_an_update_not_a_repair() {
    assert!(!integration_requires_repair(true, true, false));
    assert!(integration_requires_repair(true, false, false));
    assert!(!integration_requires_repair(true, false, true));
    assert!(!integration_requires_repair(false, false, false));
}

use super::super::installation::broker_path_is_missing;
use super::super::{AgentIntegrationId, integration_detail};

/// ADR-0039: a recorded broker that no longer resolves is the case a user cannot diagnose
/// from the badge alone. It must be named, because the fail-closed Guard turns a missing
/// broker into "every file tool is blocked", which looks like a broken app.
#[test]
fn a_configured_broker_that_cannot_run_is_named_rather_than_left_as_a_generic_repair() {
    // installed, repair needed, broker missing
    let (protection, detail) = integration_detail(
        AgentIntegrationId::Codex,
        true,
        true,
        true,
        true,
        false,
        false,
    );
    assert_eq!(protection, "inactive");
    assert!(
        detail.contains("broker"),
        "must name the broker, got: {detail}"
    );
    assert!(detail.contains("복구"), "must tell the user what to do");

    // Same flags but the broker resolves: the message stays generic.
    let (_, generic) = integration_detail(
        AgentIntegrationId::Codex,
        true,
        true,
        false,
        true,
        false,
        false,
    );
    assert_ne!(detail, generic, "the two causes must not read the same");
}

/// The boundary is only unreachable when the broker is. A healthy install must not be
/// labelled as blocked, or the warning becomes noise.
#[test]
fn a_healthy_install_is_not_reported_as_a_missing_broker() {
    let (protection, detail) = integration_detail(
        AgentIntegrationId::Codex,
        true,
        false,
        false,
        true,
        false,
        false,
    );
    assert_eq!(protection, "broker");
    assert!(
        detail.contains("연결"),
        "healthy detail expected, got: {detail}"
    );
}

#[test]
fn broker_path_is_missing_detects_absent_and_unrunnable_files() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let absent = directory.path().join("not-here");
    assert!(
        broker_path_is_missing(&absent),
        "an absent path must be reported"
    );

    let directory_path = directory.path().join("a-directory");
    std::fs::create_dir(&directory_path).expect("directory");
    assert!(
        broker_path_is_missing(&directory_path),
        "a directory is not a runnable broker"
    );

    let plain = directory.path().join("plain-file");
    std::fs::write(&plain, b"not executable").expect("write");
    #[cfg(unix)]
    assert!(
        broker_path_is_missing(&plain),
        "a file without any execute bit is not runnable"
    );

    let runnable = directory.path().join("runnable");
    std::fs::write(&runnable, b"#!/bin/sh\n").expect("write");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&runnable, std::fs::Permissions::from_mode(0o755)).expect("chmod");
        assert!(
            !broker_path_is_missing(&runnable),
            "an executable file must not be reported"
        );
    }
}
