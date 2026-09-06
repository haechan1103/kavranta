use std::fs;
use std::path::Path;

use serde_json::json;

use super::super::catalog::{copy_directory, write_json};
use super::super::cursor::{install_cursor_plugin_at, install_cursor_plugin_at_with};
use super::super::model::{KAVRANTA_REPOSITORY, PLUGIN_NAME, agent_bundle_version};

#[test]
fn cursor_plugin_installs_to_an_empty_local_directory() {
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root");
    let source = workspace.join("plugins/kavranta");
    let directory = tempfile::tempdir().expect("temporary directory");
    let target = directory.path().join(".cursor/plugins/local/kavranta");

    install_cursor_plugin_at(&source, &target).expect("Cursor plugin install");

    let manifest =
        fs::read_to_string(target.join(".cursor-plugin/plugin.json")).expect("installed manifest");
    assert!(manifest.contains(&format!(r#""version": "{}""#, agent_bundle_version())));
    assert!(target.join("mcp.json").is_file());
    assert!(target.join("cursor-hooks/hooks.json").is_file());
}

#[test]
fn cursor_update_replaces_only_an_official_kavranta_plugin() {
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root");
    let source = workspace.join("plugins/kavranta");
    let directory = tempfile::tempdir().expect("temporary directory");
    let target = directory.path().join("plugins/local/kavranta");
    copy_directory(&source, &target).expect("old plugin fixture");
    write_json(
        &target.join(".cursor-plugin/plugin.json"),
        &json!({
            "name": PLUGIN_NAME,
            "version": "1.0.0",
            "repository": KAVRANTA_REPOSITORY,
            "skills": "./skills/",
            "hooks": "./cursor-hooks/hooks.json",
            "mcpServers": "./mcp.json"
        }),
    )
    .expect("old manifest");

    install_cursor_plugin_at(&source, &target).expect("Cursor plugin update");

    let manifest: serde_json::Value = serde_json::from_slice(
        &fs::read(target.join(".cursor-plugin/plugin.json")).expect("installed manifest"),
    )
    .expect("manifest JSON");
    assert_eq!(manifest["version"], agent_bundle_version());
}

#[test]
fn cursor_install_refuses_to_overwrite_an_unrelated_plugin() {
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root");
    let source = workspace.join("plugins/kavranta");
    let directory = tempfile::tempdir().expect("temporary directory");
    let target = directory.path().join("plugins/local/kavranta");
    fs::create_dir_all(target.join(".cursor-plugin")).expect("target directory");
    write_json(
        &target.join(".cursor-plugin/plugin.json"),
        &json!({
            "name": "kavranta",
            "version": "9.9.9",
            "repository": "https://example.invalid/unrelated"
        }),
    )
    .expect("conflicting manifest");
    fs::write(target.join("keep.txt"), "unchanged").expect("sentinel");

    let error = install_cursor_plugin_at(&source, &target).expect_err("conflict must fail");

    assert_eq!(error.code, "CURSOR_PLUGIN_CONFLICT");
    assert_eq!(
        fs::read_to_string(target.join("keep.txt")).unwrap(),
        "unchanged"
    );
}

#[test]
fn cursor_update_restores_the_previous_plugin_when_swap_fails() {
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root");
    let source = workspace.join("plugins/kavranta");
    let directory = tempfile::tempdir().expect("temporary directory");
    let target = directory.path().join("plugins/local/kavranta");
    copy_directory(&source, &target).expect("old plugin fixture");
    write_json(
        &target.join(".cursor-plugin/plugin.json"),
        &json!({
            "name": PLUGIN_NAME,
            "version": "1.0.0",
            "repository": KAVRANTA_REPOSITORY,
            "skills": "./skills/",
            "hooks": "./cursor-hooks/hooks.json",
            "mcpServers": "./mcp.json"
        }),
    )
    .expect("old manifest");
    fs::write(target.join("previous.txt"), "preserved").expect("old sentinel");
    let mut rename_count = 0;

    let error = install_cursor_plugin_at_with(&source, &target, |from, to| {
        rename_count += 1;
        if rename_count == 2 {
            return Err(std::io::Error::other("synthetic swap failure"));
        }
        fs::rename(from, to)
    })
    .expect_err("swap must fail");

    assert_eq!(error.code, "CURSOR_PLUGIN_INSTALL_FAILED");
    assert_eq!(
        fs::read_to_string(target.join("previous.txt")).unwrap(),
        "preserved"
    );
    let manifest: serde_json::Value = serde_json::from_slice(
        &fs::read(target.join(".cursor-plugin/plugin.json")).expect("restored manifest"),
    )
    .expect("manifest JSON");
    assert_eq!(manifest["version"], "1.0.0");
}
