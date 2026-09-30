use std::ffi::OsString;
use std::fs;
use std::path::Path;

use super::super::catalog::{copy_directory, rewrite_opencode_guard};
use super::super::model::agent_bundle_version;
use super::super::opencode::{
    McpConfigurationState, config_root_for, foreign_entry_config_names, install_managed_files_at,
    installed_bundle_at, installed_bundle_is_official_at, mcp_add_args, mcp_configuration_state_at,
};

#[test]
fn opencode_global_config_uses_the_documented_home_path_on_windows() {
    assert_eq!(
        config_root_for(
            Path::new("C:/Users/synthetic"),
            Some(OsString::from("C:/synthetic/xdg")),
            true,
        ),
        Path::new("C:/Users/synthetic/.config/opencode")
    );
}

#[test]
fn opencode_mcp_command_uses_the_non_interactive_pure_global_shape() {
    let broker = Path::new("/synthetic/app/bin/kavranta-broker");
    let app_data = Path::new("/synthetic/app/data");

    assert_eq!(
        mcp_add_args(broker, app_data),
        vec![
            OsString::from("--pure"),
            OsString::from("mcp"),
            OsString::from("add"),
            OsString::from("kavranta"),
            OsString::from("--env"),
            OsString::from(format!(
                "KAVRANTA_AUDIT_DIR={}",
                app_data.join("agent-activity").to_string_lossy()
            )),
            OsString::from("--env"),
            OsString::from("KAVRANTA_APP_DATA_DIR=/synthetic/app/data"),
            OsString::from("--env"),
            OsString::from("KAVRANTA_AGENT_HOST=opencode"),
            OsString::from("--"),
            broker.as_os_str().to_owned(),
        ]
    );
}

#[test]
fn opencode_config_health_accepts_jsonc_and_requires_the_exact_managed_connection() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let broker = Path::new("/synthetic/app/bin/kavranta-broker");
    let app_data = Path::new("/synthetic/app/data");
    write_config(
        directory.path(),
        "opencode.jsonc",
        &format!(
            r#"{{
              // Synthetic OpenCode configuration.
              "mcp": {{
                "kavranta": {{
                  "type": "local",
                  "command": [{}],
                  "environment": {{
                    "KAVRANTA_AUDIT_DIR": {},
                    "KAVRANTA_APP_DATA_DIR": {},
                    "KAVRANTA_AGENT_HOST": "opencode",
                  }},
                }},
              }},
            }}"#,
            json_path(broker),
            json_path(&app_data.join("agent-activity")),
            json_path(app_data),
        ),
    );

    assert_eq!(
        mcp_configuration_state_at(directory.path(), broker, app_data)
            .expect("configuration state"),
        McpConfigurationState::Current
    );
}

#[test]
fn opencode_config_health_refuses_an_unrelated_same_name_server() {
    let directory = tempfile::tempdir().expect("temporary directory");
    write_config(
        directory.path(),
        "opencode.json",
        r#"{
          "mcp": {
            "kavranta": {
              "type": "local",
              "command": ["/synthetic/unrelated-server"]
            }
          }
        }"#,
    );

    assert_eq!(
        mcp_configuration_state_at(
            directory.path(),
            Path::new("/synthetic/app/bin/kavranta-broker"),
            Path::new("/synthetic/app/data"),
        )
        .expect("configuration state"),
        McpConfigurationState::Conflict
    );
}

/// Regression: both `opencode.json` and `opencode.jsonc` are valid OpenCode config
/// names, and Kavranta's own `opencode mcp add` creates the former while a user may
/// already keep the latter. Two Kavranta-owned entries are stronger evidence that
/// the entries are ours, not weaker, so this must not escalate to Conflict. Conflict
/// refuses to touch either file, so escalating made repair permanently unresolvable.
#[test]
fn opencode_config_health_accepts_the_same_kavranta_entry_in_both_global_files() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let broker = Path::new("/synthetic/app/bin/kavranta-broker");
    let app_data = Path::new("/synthetic/app/data");
    let entry = owned_entry_json(broker, app_data);
    write_config(directory.path(), "opencode.json", &entry);
    write_config(directory.path(), "opencode.jsonc", &entry);

    assert_eq!(
        mcp_configuration_state_at(directory.path(), broker, app_data)
            .expect("configuration state"),
        McpConfigurationState::Current
    );
}

/// OpenCode reads one of the two files. A current owned entry in one of them means
/// the host is configured correctly, so a stale sibling left by an earlier repair
/// must not keep the integration in a repair loop.
#[test]
fn opencode_config_health_is_current_when_one_owned_entry_is_current() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let broker = Path::new("/synthetic/app/bin/kavranta-broker");
    let app_data = Path::new("/synthetic/app/data");
    write_config(
        directory.path(),
        "opencode.json",
        &owned_entry_json(broker, app_data),
    );
    write_config(
        directory.path(),
        "opencode.jsonc",
        &owned_entry_json(
            Path::new("/synthetic/app/bin/0.7.9/kavranta-broker"),
            app_data,
        ),
    );

    assert_eq!(
        mcp_configuration_state_at(directory.path(), broker, app_data)
            .expect("configuration state"),
        McpConfigurationState::Current
    );
    assert!(
        foreign_entry_config_names(directory.path()).is_empty(),
        "an owned entry pointing at an older broker is still Kavranta's own"
    );
}

/// Repair still has to run when every owned entry is stale, so this must not read as
/// Current just because more than one entry was found.
#[test]
fn opencode_config_health_repairs_when_every_owned_entry_is_stale() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let broker = Path::new("/synthetic/app/bin/kavranta-broker");
    let app_data = Path::new("/synthetic/app/data");
    let stale = owned_entry_json(
        Path::new("/synthetic/app/bin/0.7.9/kavranta-broker"),
        app_data,
    );
    write_config(directory.path(), "opencode.json", &stale);
    write_config(directory.path(), "opencode.jsonc", &stale);

    assert_eq!(
        mcp_configuration_state_at(directory.path(), broker, app_data)
            .expect("configuration state"),
        McpConfigurationState::OwnedStale
    );
}

/// Relaxing the duplicate rule must not weaken the guard that protects a
/// hand-written kavranta entry. One foreign entry anywhere still means Conflict.
#[test]
fn opencode_config_health_still_refuses_a_foreign_entry_beside_an_owned_one() {
    let directory = tempfile::tempdir().expect("temporary directory");
    let broker = Path::new("/synthetic/app/bin/kavranta-broker");
    let app_data = Path::new("/synthetic/app/data");
    write_config(
        directory.path(),
        "opencode.json",
        &owned_entry_json(broker, app_data),
    );
    write_config(
        directory.path(),
        "opencode.jsonc",
        r#"{
          "mcp": {
            "kavranta": {
              "type": "local",
              "command": ["/synthetic/unrelated-server"]
            }
          }
        }"#,
    );

    assert_eq!(
        mcp_configuration_state_at(directory.path(), broker, app_data)
            .expect("configuration state"),
        McpConfigurationState::Conflict
    );
    assert_eq!(
        foreign_entry_config_names(directory.path()),
        vec!["opencode.jsonc"]
    );
}

#[test]
fn opencode_config_health_refuses_a_malformed_mcp_section_before_installation() {
    let directory = tempfile::tempdir().expect("temporary directory");
    write_config(
        directory.path(),
        "opencode.jsonc",
        r#"{ "mcp": "not-an-object" }"#,
    );

    let error = mcp_configuration_state_at(
        directory.path(),
        Path::new("/synthetic/app/bin/kavranta-broker"),
        Path::new("/synthetic/app/data"),
    )
    .expect_err("malformed MCP config must stop installation");

    assert_eq!(error.code, "OPENCODE_CONFIG_INVALID");
}

#[test]
fn opencode_config_health_distinguishes_an_owned_stale_connection() {
    let directory = tempfile::tempdir().expect("temporary directory");
    write_config(
        directory.path(),
        "opencode.jsonc",
        r#"{
          "mcp": {
            "kavranta": {
              "type": "local",
              "command": ["/synthetic/old/kavranta-broker"],
              "enabled": false,
              "environment": {
                "KAVRANTA_AUDIT_DIR": "/synthetic/old/agent-activity",
                "KAVRANTA_APP_DATA_DIR": "/synthetic/old",
                "KAVRANTA_AGENT_HOST": "opencode"
              }
            }
          }
        }"#,
    );

    assert_eq!(
        mcp_configuration_state_at(
            directory.path(),
            Path::new("/synthetic/app/bin/kavranta-broker"),
            Path::new("/synthetic/app/data"),
        )
        .expect("configuration state"),
        McpConfigurationState::OwnedStale
    );
}

#[test]
fn opencode_managed_files_install_with_an_official_identity_and_shared_skill() {
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root");
    let directory = tempfile::tempdir().expect("temporary directory");
    let source = directory.path().join("materialized-source");
    let target = directory.path().join("opencode-config");
    let broker = Path::new("/synthetic/app/bin/kavranta-broker");
    copy_directory(&workspace.join("plugins/kavranta"), &source).expect("source fixture");
    rewrite_opencode_guard(&source.join("opencode/kavranta-guard.js"), broker)
        .expect("materialized guard");

    install_managed_files_at(&source, &target, broker).expect("OpenCode files install");

    assert!(installed_bundle_is_official_at(&target));
    assert_eq!(
        installed_bundle_at(&target).map(|(version, _)| version),
        Some(agent_bundle_version().to_owned())
    );
    assert!(target.join("plugins/kavranta.js").is_file());
    assert!(target.join("skills/kavranta-env/SKILL.md").is_file());
    let guard = fs::read_to_string(target.join("plugins/kavranta.js")).expect("installed guard");
    assert!(guard.contains("/synthetic/app/bin/kavranta-broker"));
    assert!(!guard.contains("__KAVRANTA_BROKER_PATH__"));
}

#[test]
fn opencode_install_does_not_replace_unowned_files() {
    let workspace = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .expect("workspace root");
    let directory = tempfile::tempdir().expect("temporary directory");
    let source = directory.path().join("materialized-source");
    let target = directory.path().join("opencode-config");
    let broker = Path::new("/synthetic/app/bin/kavranta-broker");
    copy_directory(&workspace.join("plugins/kavranta"), &source).expect("source fixture");
    rewrite_opencode_guard(&source.join("opencode/kavranta-guard.js"), broker)
        .expect("materialized guard");
    fs::create_dir_all(target.join("plugins")).expect("plugin directory");
    fs::write(target.join("plugins/kavranta.js"), "unrelated plugin\n").expect("unrelated fixture");

    let error = install_managed_files_at(&source, &target, broker)
        .expect_err("unowned file must not be overwritten");

    assert_eq!(error.code, "OPENCODE_BUNDLE_CONFLICT");
    assert_eq!(
        fs::read_to_string(target.join("plugins/kavranta.js")).expect("preserved fixture"),
        "unrelated plugin\n"
    );
}

fn write_config(root: &Path, name: &str, source: &str) {
    fs::create_dir_all(root).expect("configuration directory");
    fs::write(root.join(name), source).expect("synthetic configuration");
}

fn owned_entry_json(broker: &Path, app_data: &Path) -> String {
    format!(
        r#"{{
          "mcp": {{
            "kavranta": {{
              "type": "local",
              "command": [{}],
              "environment": {{
                "KAVRANTA_AUDIT_DIR": {},
                "KAVRANTA_APP_DATA_DIR": {},
                "KAVRANTA_AGENT_HOST": "opencode"
              }}
            }}
          }}
        }}"#,
        json_path(broker),
        json_path(&app_data.join("agent-activity")),
        json_path(app_data),
    )
}

fn json_path(path: &Path) -> String {
    serde_json::to_string(&path.to_string_lossy()).expect("synthetic path serialization")
}
