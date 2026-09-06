use std::fs;
use std::path::PathBuf;

use serde_json::json;

use super::super::catalog::write_json;
use super::super::installation::{
    connection_files_are_current, manifest_is_official,
    official_legacy_codex_marketplace_aliases_from_config,
};
use super::super::model::{
    AgentIntegrationId, CodexMarketplaceAlias, InstallationMarker, KAVRANTA_REPOSITORY,
    LEGACY_ENV_MANAGER_REPOSITORY, LEGACY_MARKETPLACE_NAME, LEGACY_PLUGIN_NAME, PLUGIN_NAME,
    is_legacy_bundle_version,
};

#[test]
fn codex_discovers_the_config_key_for_an_official_legacy_marketplace() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let marketplace_root = directory.path().join("marketplace");
    let plugin_root = marketplace_root.join("plugins/env-manager");
    fs::create_dir_all(plugin_root.join(".codex-plugin")).expect("plugin directory");
    fs::create_dir_all(marketplace_root.join(".agents/plugins")).expect("marketplace directory");
    write_json(
        &plugin_root.join(".codex-plugin/plugin.json"),
        &json!({
            "name": LEGACY_PLUGIN_NAME,
            "repository": LEGACY_ENV_MANAGER_REPOSITORY,
        }),
    )
    .expect("plugin manifest");
    write_json(
        &marketplace_root.join(".agents/plugins/marketplace.json"),
        &json!({
            "name": LEGACY_MARKETPLACE_NAME,
            "plugins": [{
                "name": LEGACY_PLUGIN_NAME,
                "source": { "source": "local", "path": "./plugins/env-manager" },
            }],
        }),
    )
    .expect("marketplace manifest");
    let config = directory.path().join("config.toml");
    fs::write(
        &config,
        format!(
            "[marketplaces.personal]\nsource_type = \"local\"\nsource = {0:?}\n\n[marketplaces.env-manager-desktop]\nsource_type = \"local\"\nsource = {0:?}\n",
            marketplace_root.to_string_lossy(),
        ),
    )
    .expect("Codex config");

    assert_eq!(
        official_legacy_codex_marketplace_aliases_from_config(&config),
        vec![CodexMarketplaceAlias {
            name: "env-manager-desktop".to_owned(),
            remove_marketplace: true,
        }]
    );
}

#[test]
fn official_bundle_recognizes_current_and_pre_rename_identities() {
    for (name, repository) in [
        (PLUGIN_NAME, KAVRANTA_REPOSITORY),
        (LEGACY_PLUGIN_NAME, LEGACY_ENV_MANAGER_REPOSITORY),
    ] {
        assert!(manifest_is_official(&json!({
            "name": name,
            "repository": repository,
        })));
    }
}

#[test]
fn official_bundle_rejects_unrelated_or_unidentified_plugins() {
    assert!(!manifest_is_official(&json!({
        "name": PLUGIN_NAME,
        "repository": "https://github.com/example/env-manager",
    })));
    assert!(!manifest_is_official(&json!({ "name": PLUGIN_NAME })));
}

#[test]
fn legacy_installation_markers_remain_readable() {
    let marker = serde_json::from_str::<InstallationMarker>(r#"{"version":"0.5.0"}"#)
        .expect("legacy marker");
    assert_eq!(marker.bundle_version, "0.5.0");
    assert!(is_legacy_bundle_version(&marker.bundle_version));
}

#[test]
fn connection_health_requires_broker_app_data_audit_and_host_identity() {
    let synthetic_root = PathBuf::from("synthetic");
    let broker = synthetic_root.join("kavranta-broker");
    let app_data = synthetic_root.join("app-data");
    let broker_text = broker.to_string_lossy().into_owned();
    let app_data_text = app_data.to_string_lossy().into_owned();
    let audit_text = app_data
        .join("agent-activity")
        .to_string_lossy()
        .into_owned();
    let hooks = json!({
        "hooks": { "PreToolUse": [{
            "hooks": [{ "command": format!("\"{broker_text}\" guard-hook") }]
        }] }
    });
    let configured = json!({
        "mcpServers": { "kavranta": {
            "command": broker_text,
            "env": {
                "KAVRANTA_AUDIT_DIR": audit_text,
                "KAVRANTA_APP_DATA_DIR": app_data_text,
                "KAVRANTA_AGENT_HOST": "codex"
            }
        } }
    });
    let missing_audit = json!({
        "mcpServers": { "kavranta": {
            "command": broker.to_string_lossy(),
            "env": {
                "KAVRANTA_APP_DATA_DIR": app_data.to_string_lossy(),
                "KAVRANTA_AGENT_HOST": "codex"
            }
        } }
    });

    assert!(connection_files_are_current(
        &configured,
        &hooks,
        &broker,
        &app_data,
        AgentIntegrationId::Codex,
    ));
    assert!(!connection_files_are_current(
        &missing_audit,
        &hooks,
        &broker,
        &app_data,
        AgentIntegrationId::Codex,
    ));
    assert!(!connection_files_are_current(
        &configured,
        &hooks,
        &broker,
        &app_data,
        AgentIntegrationId::ClaudeCode,
    ));
}

#[test]
fn cursor_connection_health_requires_its_fail_closed_hook_schema() {
    let synthetic_root = PathBuf::from("synthetic");
    let broker = synthetic_root.join("kavranta-broker");
    let app_data = synthetic_root.join("app-data");
    let broker_text = broker.to_string_lossy().into_owned();
    let configured = json!({
        "mcpServers": { "kavranta": {
            "command": broker_text,
            "env": {
                "KAVRANTA_AUDIT_DIR": app_data.join("agent-activity").to_string_lossy(),
                "KAVRANTA_APP_DATA_DIR": app_data.to_string_lossy(),
                "KAVRANTA_AGENT_HOST": "cursor"
            }
        } }
    });
    let command = format!("\"{}\" guard-hook", broker.to_string_lossy());
    let guarded = json!({
        "version": 1,
        "hooks": {
            "preToolUse": [{
                "command": command,
                "matcher": "Shell|Read|Write|Grep|Delete",
                "timeout": 5,
                "failClosed": true
            }],
            "beforeReadFile": [{
                "command": command,
                "timeout": 5,
                "failClosed": true
            }],
            "beforeTabFileRead": [{
                "command": command,
                "timeout": 5,
                "failClosed": true
            }]
        }
    });
    let mut missing_tab_guard = guarded.clone();
    missing_tab_guard["hooks"]
        .as_object_mut()
        .expect("hooks object")
        .remove("beforeTabFileRead");
    let mut fail_open = guarded.clone();
    fail_open["hooks"]["beforeReadFile"][0]["failClosed"] = json!(false);

    assert!(connection_files_are_current(
        &configured,
        &guarded,
        &broker,
        &app_data,
        AgentIntegrationId::Cursor,
    ));
    assert!(!connection_files_are_current(
        &configured,
        &fail_open,
        &broker,
        &app_data,
        AgentIntegrationId::Cursor,
    ));
    assert!(!connection_files_are_current(
        &configured,
        &missing_tab_guard,
        &broker,
        &app_data,
        AgentIntegrationId::Cursor,
    ));
}
