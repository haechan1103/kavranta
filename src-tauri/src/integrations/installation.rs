use std::fs;
use std::path::{Path, PathBuf};

use directories::BaseDirs;
use semver::Version;
use serde_json::{Value, json};
use tauri::{AppHandle, Manager};

use super::cursor::cursor_local_plugin_root;
use super::model::{
    AgentIntegrationId, CODEX_MARKETPLACE_NAME, CodexMarketplaceAlias, InstallationMarker,
    IntegrationError, KAVRANTA_REPOSITORY, LEGACY_ENV_MANAGER_REPOSITORY, LEGACY_PLUGIN_NAME,
    MCP_SERVER_NAME, PLUGIN_NAME, agent_bundle_version, integration_slug, legacy_marketplace_names,
    marketplace_name,
};

pub(super) fn current_bundle_is_cached(id: AgentIntegrationId) -> bool {
    current_cached_bundle(id)
        .map(|(version, _)| version)
        .as_deref()
        == Some(agent_bundle_version())
}

pub(super) fn connection_configuration_is_current(
    app: &AppHandle,
    id: AgentIntegrationId,
    broker: &Path,
) -> bool {
    let Some((version, root)) = current_cached_bundle(id) else {
        return false;
    };
    if version != agent_bundle_version() {
        return false;
    }
    let Ok(app_data) = app.path().app_data_dir() else {
        return false;
    };
    let mcp_name = if id == AgentIntegrationId::Cursor {
        "mcp.json"
    } else {
        ".mcp.json"
    };
    let hook_name = if id == AgentIntegrationId::Cursor {
        "cursor-hooks/hooks.json"
    } else {
        "hooks/hooks.json"
    };
    let Ok(mcp) = read_plugin_json(&root.join(mcp_name)) else {
        return false;
    };
    let Ok(hooks) = read_plugin_json(&root.join(hook_name)) else {
        return false;
    };
    connection_files_are_current(&mcp, &hooks, broker, &app_data, id)
}

pub(super) fn connection_files_are_current(
    mcp: &Value,
    hooks: &Value,
    broker: &Path,
    app_data: &Path,
    id: AgentIntegrationId,
) -> bool {
    let server = &mcp["mcpServers"][MCP_SERVER_NAME];
    let expected_audit = app_data
        .join("agent-activity")
        .to_string_lossy()
        .into_owned();
    let expected_app_data = app_data.to_string_lossy().into_owned();
    let expected_broker = broker.to_string_lossy();
    let expected_hook = format!("\"{expected_broker}\" guard-hook");
    let hook_command = hooks["hooks"]["PreToolUse"][0]["hooks"][0]["command"].as_str();
    server["command"].as_str() == Some(expected_broker.as_ref())
        && server["env"]["KAVRANTA_AUDIT_DIR"].as_str() == Some(expected_audit.as_str())
        && server["env"]["KAVRANTA_APP_DATA_DIR"].as_str() == Some(expected_app_data.as_str())
        && server["env"]["KAVRANTA_AGENT_HOST"].as_str() == Some(integration_slug(id))
        && (id == AgentIntegrationId::Cursor && cursor_hooks_are_current(hooks, &expected_hook)
            || id != AgentIntegrationId::Cursor && hook_command == Some(expected_hook.as_str()))
}

fn cursor_hooks_are_current(hooks: &Value, expected_command: &str) -> bool {
    hooks["version"].as_u64() == Some(1)
        && ["preToolUse", "beforeReadFile", "beforeTabFileRead"]
            .into_iter()
            .all(|event| {
                let Some(entries) = hooks["hooks"][event].as_array() else {
                    return false;
                };
                if entries.len() != 1 {
                    return false;
                }
                let entry = &entries[0];
                entry["command"].as_str() == Some(expected_command)
                    && entry["timeout"].as_u64() == Some(5)
                    && entry["failClosed"].as_bool() == Some(true)
                    && (event != "preToolUse"
                        || entry["matcher"].as_str() == Some("Shell|Read|Write|Grep|Delete"))
            })
}

pub(super) fn cached_bundle_is_official(id: AgentIntegrationId) -> bool {
    let Some((_, root)) = current_cached_bundle(id) else {
        return false;
    };
    let manifest_name = match id {
        AgentIntegrationId::Codex => ".codex-plugin/plugin.json",
        AgentIntegrationId::ClaudeCode | AgentIntegrationId::GithubCopilot => {
            ".claude-plugin/plugin.json"
        }
        AgentIntegrationId::Cursor => ".cursor-plugin/plugin.json",
    };
    let Ok(manifest) = read_plugin_json(&root.join(manifest_name)) else {
        return false;
    };
    manifest_is_current_official(&manifest)
}

#[cfg(test)]
pub(super) fn manifest_is_official(manifest: &Value) -> bool {
    manifest_is_current_official(manifest) || manifest_is_legacy_official(manifest)
}

fn manifest_is_current_official(manifest: &Value) -> bool {
    manifest["name"].as_str() == Some(PLUGIN_NAME) && manifest_repository_is_official(manifest)
}

fn manifest_is_legacy_official(manifest: &Value) -> bool {
    manifest["name"].as_str() == Some(LEGACY_PLUGIN_NAME)
        && manifest_repository_is_official(manifest)
}

fn manifest_repository_is_official(manifest: &Value) -> bool {
    matches!(
        manifest["repository"].as_str(),
        Some(KAVRANTA_REPOSITORY) | Some(LEGACY_ENV_MANAGER_REPOSITORY)
    )
}

pub(super) fn official_legacy_codex_marketplace_aliases() -> Vec<CodexMarketplaceAlias> {
    let Some(base) = BaseDirs::new() else {
        return Vec::new();
    };
    official_legacy_codex_marketplace_aliases_from_config(
        &base.home_dir().join(".codex/config.toml"),
    )
}

pub(super) fn official_legacy_codex_marketplace_aliases_from_config(
    config_path: &Path,
) -> Vec<CodexMarketplaceAlias> {
    let Ok(source) = fs::read_to_string(config_path) else {
        return Vec::new();
    };
    let Ok(config) = toml::from_str::<toml::Table>(&source) else {
        return Vec::new();
    };
    let Some(marketplaces) = config.get("marketplaces").and_then(toml::Value::as_table) else {
        return Vec::new();
    };

    marketplaces
        .iter()
        .filter(|(name, _)| {
            name.as_str() != CODEX_MARKETPLACE_NAME
                && legacy_marketplace_names(AgentIntegrationId::Codex).contains(&name.as_str())
        })
        .filter_map(|(name, settings)| {
            let settings = settings.as_table()?;
            if settings.get("source_type").and_then(toml::Value::as_str) != Some("local") {
                return None;
            }
            let root = PathBuf::from(settings.get("source")?.as_str()?);
            Some(CodexMarketplaceAlias {
                name: name.clone(),
                remove_marketplace: codex_marketplace_contains_only_legacy_plugin(&root)?,
            })
        })
        .collect()
}

fn codex_marketplace_contains_only_legacy_plugin(root: &Path) -> Option<bool> {
    let root = fs::canonicalize(root).ok()?;
    let marketplace = read_plugin_json(&root.join(".agents/plugins/marketplace.json")).ok()?;
    let plugins = marketplace["plugins"].as_array()?;
    let plugin = plugins
        .iter()
        .find(|plugin| plugin["name"].as_str() == Some(LEGACY_PLUGIN_NAME))?;
    let source = &plugin["source"];
    let relative = source
        .as_str()
        .or_else(|| source.get("path").and_then(Value::as_str))?;
    if source.is_object() && source.get("source").and_then(Value::as_str) != Some("local") {
        return None;
    }
    let plugin_root = fs::canonicalize(root.join(relative)).ok()?;
    if !plugin_root.starts_with(&root) {
        return None;
    }
    let manifest = read_plugin_json(&plugin_root.join(".codex-plugin/plugin.json")).ok()?;
    manifest_is_legacy_official(&manifest).then_some(plugins.len() == 1)
}

pub(super) fn persist_marker(
    app: &AppHandle,
    id: AgentIntegrationId,
) -> Result<(), IntegrationError> {
    let app_data = app.path().app_data_dir().map_err(|_| IntegrationError {
        code: "APP_DATA_UNAVAILABLE",
        message: "앱 데이터 경로를 확인하지 못했습니다.",
    })?;
    let directory = app_data.join("agent-integrations/installations");
    fs::create_dir_all(&directory).map_err(|_| IntegrationError {
        code: "INSTALL_STATE_WRITE_FAILED",
        message: "연동 설치 상태를 저장하지 못했습니다.",
    })?;
    let mut bytes = serde_json::to_vec_pretty(&json!(InstallationMarker {
        bundle_version: agent_bundle_version().to_owned(),
    }))
    .map_err(|_| IntegrationError {
        code: "INSTALL_STATE_WRITE_FAILED",
        message: "연동 설치 상태를 저장하지 못했습니다.",
    })?;
    bytes.push(b'\n');
    fs::write(
        directory.join(format!("{}.json", integration_slug(id))),
        bytes,
    )
    .map_err(|_| IntegrationError {
        code: "INSTALL_STATE_WRITE_FAILED",
        message: "연동 설치 상태를 저장하지 못했습니다.",
    })
}

pub(super) fn installed_version(app: &AppHandle, id: AgentIntegrationId) -> Option<String> {
    let cached = cache_version(id);
    if id == AgentIntegrationId::Cursor {
        cached
    } else {
        cached.or_else(|| marker_version(app, id))
    }
}

pub(super) fn marker_version(app: &AppHandle, id: AgentIntegrationId) -> Option<String> {
    let path = app
        .path()
        .app_data_dir()
        .ok()?
        .join("agent-integrations/installations")
        .join(format!("{}.json", integration_slug(id)));
    let bytes = fs::read(path).ok()?;
    serde_json::from_slice::<InstallationMarker>(&bytes)
        .ok()
        .map(|marker| marker.bundle_version)
}

fn cache_version(id: AgentIntegrationId) -> Option<String> {
    current_cached_bundle(id)
        .or_else(|| legacy_cached_bundle(id))
        .map(|(version, _)| version)
}

fn current_cached_bundle(id: AgentIntegrationId) -> Option<(String, PathBuf)> {
    if id == AgentIntegrationId::Cursor {
        let root = cursor_local_plugin_root()?;
        let manifest = root.join(".cursor-plugin/plugin.json");
        let version = read_plugin_json(&manifest)
            .ok()?
            .get("version")?
            .as_str()?
            .to_owned();
        return Some((version, root));
    }
    cached_bundle_in_marketplace(id, marketplace_name(id), PLUGIN_NAME)
}

fn legacy_cached_bundles(id: AgentIntegrationId) -> impl Iterator<Item = (String, PathBuf)> {
    legacy_marketplace_names(id)
        .iter()
        .filter_map(move |marketplace| {
            cached_bundle_in_marketplace(id, marketplace, LEGACY_PLUGIN_NAME)
        })
}

fn legacy_cached_bundle(id: AgentIntegrationId) -> Option<(String, PathBuf)> {
    legacy_cached_bundles(id).max_by(|(left, _), (right, _)| {
        match (Version::parse(left), Version::parse(right)) {
            (Ok(left), Ok(right)) => left.cmp(&right),
            _ => left.cmp(right),
        }
    })
}

fn cached_bundle_in_marketplace(
    id: AgentIntegrationId,
    marketplace: &str,
    plugin: &str,
) -> Option<(String, PathBuf)> {
    let base = BaseDirs::new()?;
    let (root, manifest) = match id {
        AgentIntegrationId::Codex => (
            base.home_dir()
                .join(".codex/plugins/cache")
                .join(marketplace)
                .join(plugin),
            ".codex-plugin/plugin.json",
        ),
        AgentIntegrationId::ClaudeCode => (
            base.home_dir()
                .join(".claude/plugins/cache")
                .join(marketplace)
                .join(plugin),
            ".claude-plugin/plugin.json",
        ),
        AgentIntegrationId::GithubCopilot => (
            base.home_dir()
                .join(".copilot/installed-plugins")
                .join(marketplace)
                .join(plugin),
            ".claude-plugin/plugin.json",
        ),
        AgentIntegrationId::Cursor => return None,
    };
    newest_manifest_bundle(&root, manifest)
}

pub(super) fn legacy_bundle_is_official(id: AgentIntegrationId) -> bool {
    !official_legacy_cached_marketplaces(id).is_empty()
}

pub(super) fn official_legacy_cached_marketplaces(id: AgentIntegrationId) -> Vec<String> {
    let manifest_name = match id {
        AgentIntegrationId::Codex => ".codex-plugin/plugin.json",
        AgentIntegrationId::ClaudeCode | AgentIntegrationId::GithubCopilot => {
            ".claude-plugin/plugin.json"
        }
        AgentIntegrationId::Cursor => ".cursor-plugin/plugin.json",
    };
    legacy_marketplace_names(id)
        .iter()
        .filter(|marketplace| {
            cached_bundle_in_marketplace(id, marketplace, LEGACY_PLUGIN_NAME).is_some_and(
                |(_, root)| {
                    read_plugin_json(&root.join(manifest_name))
                        .is_ok_and(|manifest| manifest_is_legacy_official(&manifest))
                },
            )
        })
        .map(|marketplace| (*marketplace).to_owned())
        .collect()
}

fn read_plugin_json(path: &Path) -> Result<Value, IntegrationError> {
    let bytes = fs::read(path).map_err(|_| IntegrationError {
        code: "PLUGIN_CONFIG_UNAVAILABLE",
        message: "플러그인 설정을 읽지 못했습니다.",
    })?;
    serde_json::from_slice(&bytes).map_err(|_| IntegrationError {
        code: "PLUGIN_CONFIG_INVALID",
        message: "플러그인 설정 형식이 올바르지 않습니다.",
    })
}

fn newest_manifest_bundle(root: &Path, manifest: &str) -> Option<(String, PathBuf)> {
    let entries = fs::read_dir(root).ok()?;
    let versions = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.path().join(manifest).is_file())
        .filter_map(|entry| {
            let bytes = fs::read(entry.path().join(manifest)).ok()?;
            let version = serde_json::from_slice::<Value>(&bytes)
                .ok()?
                .get("version")?
                .as_str()
                .map(str::to_owned)?;
            Some((version, entry.path()))
        })
        .collect::<Vec<_>>();
    versions.into_iter().max_by(|(left, _), (right, _)| {
        match (Version::parse(left), Version::parse(right)) {
            (Ok(left), Ok(right)) => left.cmp(&right),
            _ => left.cmp(right),
        }
    })
}
