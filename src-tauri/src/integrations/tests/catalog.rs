use std::fs;
use std::path::Path;

use super::super::catalog::{
    catalog_is_valid, read_json, rewrite_marketplace_name, rewrite_opencode_guard,
};
use super::super::model::{CODEX_MARKETPLACE_NAME, agent_bundle_version};

#[test]
fn codex_materialized_marketplace_gets_the_app_owned_name() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let marketplace = directory.path().join("marketplace.json");
    fs::write(&marketplace, r#"{"name":"kavranta","plugins":[]}"#).expect("marketplace fixture");

    rewrite_marketplace_name(&marketplace, CODEX_MARKETPLACE_NAME)
        .expect("marketplace name rewrite");

    let rewritten = read_json(&marketplace).expect("rewritten marketplace");
    assert_eq!(rewritten["name"], CODEX_MARKETPLACE_NAME);
}

#[test]
fn catalog_validation_requires_every_agent_manifest() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root");
    assert!(catalog_is_valid(root));
}

#[test]
fn agent_bundle_version_is_independent_from_the_app_release() {
    assert_eq!(agent_bundle_version(), "2.6.0");
    assert_ne!(agent_bundle_version(), env!("CARGO_PKG_VERSION"));
}

#[test]
fn opencode_guard_materialization_uses_a_json_escaped_absolute_broker_path() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let guard = directory.path().join("kavranta-guard.js");
    fs::write(&guard, "const broker = \"__KAVRANTA_BROKER_PATH__\";\n").expect("guard fixture");
    let broker = Path::new("/synthetic/Kavranta Broker/bin/kavranta-broker");

    rewrite_opencode_guard(&guard, broker).expect("guard rewrite");

    let rewritten = fs::read_to_string(guard).expect("rewritten guard");
    assert_eq!(
        rewritten,
        "const broker = \"/synthetic/Kavranta Broker/bin/kavranta-broker\";\n"
    );
}
