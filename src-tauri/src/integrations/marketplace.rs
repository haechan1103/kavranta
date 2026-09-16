use std::ffi::OsString;
use std::path::Path;

use super::command::run_agent_command;
use super::installation::official_legacy_cached_marketplaces;
use super::model::{
    AgentIntegrationId, CODEX_MARKETPLACE_NAME, CodexMarketplaceAlias, IntegrationError,
    LEGACY_PLUGIN_NAME, PLUGIN_NAME, marketplace_name,
};

pub(super) fn marketplace_add_args(_id: AgentIntegrationId, catalog: OsString) -> Vec<OsString> {
    vec!["plugin".into(), "marketplace".into(), "add".into(), catalog]
}

fn marketplace_remove_args(id: AgentIntegrationId) -> Vec<OsString> {
    marketplace_remove_named_args(marketplace_name(id))
}

pub(super) fn marketplace_remove_named_args(name: &str) -> Vec<OsString> {
    vec![
        "plugin".into(),
        "marketplace".into(),
        "remove".into(),
        name.into(),
    ]
}

pub(super) fn reconnect_owned_marketplace(
    executable: &Path,
    id: AgentIntegrationId,
    catalog: OsString,
) -> Result<(), IntegrationError> {
    // Call only after finding an app-owned marker or validating the cached bundle as
    // this project's official plugin. An unrelated marketplace is never removed.
    let _ = run_agent_command(executable, marketplace_remove_args(id));
    if run_agent_command(executable, marketplace_add_args(id, catalog)) {
        Ok(())
    } else {
        Err(IntegrationError {
            code: "AGENT_MARKETPLACE_FAILED",
            message: "AI 도구의 Kavranta marketplace를 연결하지 못했습니다.",
        })
    }
}

pub(super) fn install_or_update(executable: &Path, id: AgentIntegrationId) -> bool {
    run_agent_command(executable, install_args(id))
        || run_agent_command(executable, update_args(id))
}

pub(super) fn stage_owned_codex_marketplace(
    executable: &Path,
    catalog: OsString,
) -> Result<(), IntegrationError> {
    if stage_owned_codex_marketplace_with(catalog, |args| run_agent_command(executable, args)) {
        Ok(())
    } else {
        Err(IntegrationError {
            code: "AGENT_MARKETPLACE_FAILED",
            message: "Codex의 기존 Kavranta 연결을 새 연동 번들로 교체하지 못했습니다.",
        })
    }
}

pub(super) fn stage_owned_codex_marketplace_with(
    catalog: OsString,
    mut run: impl FnMut(Vec<OsString>) -> bool,
) -> bool {
    let id = AgentIntegrationId::Codex;

    // Refresh only the new Kavranta identity. A legacy Env Manager installation
    // remains usable until this new plugin has been installed and validated.
    let _ = run(remove_args(id));
    let _ = run(marketplace_remove_named_args(CODEX_MARKETPLACE_NAME));
    run(marketplace_add_args(id, catalog)) && run(install_args(id))
}

pub(super) fn cleanup_legacy_connections(
    executable: &Path,
    id: AgentIntegrationId,
    codex_aliases: &[CodexMarketplaceAlias],
) -> bool {
    cleanup_legacy_connections_with(
        id,
        codex_aliases,
        &official_legacy_cached_marketplaces(id),
        |args| run_agent_command(executable, args),
    )
}

pub(super) fn cleanup_legacy_connections_with(
    id: AgentIntegrationId,
    codex_aliases: &[CodexMarketplaceAlias],
    official_legacy_marketplaces: &[String],
    mut run: impl FnMut(Vec<OsString>) -> bool,
) -> bool {
    let mut cleaned = true;
    if id == AgentIntegrationId::Codex {
        let mut handled = std::collections::BTreeSet::new();
        for alias in codex_aliases {
            handled.insert(alias.name.clone());
            let selector = legacy_plugin_selector(&alias.name);
            let plugin_removed = run(remove_plugin_args(id, selector));
            if alias.remove_marketplace {
                cleaned &= run(marketplace_remove_named_args(&alias.name));
            } else {
                cleaned &= plugin_removed;
            }
        }
        for marketplace in official_legacy_marketplaces {
            if handled.insert(marketplace.clone()) {
                let selector = legacy_plugin_selector(marketplace);
                cleaned &= run(remove_plugin_args(id, selector));
            }
        }
        return cleaned;
    }

    for marketplace in official_legacy_marketplaces {
        let selector = legacy_plugin_selector(marketplace);
        cleaned &= run(remove_plugin_args(id, selector));
    }
    cleaned
}

pub(super) fn refresh_after_marketplace_reconnect(
    executable: &Path,
    id: AgentIntegrationId,
) -> bool {
    refresh_after_marketplace_reconnect_with(id, |args| run_agent_command(executable, args))
}

pub(super) fn refresh_after_marketplace_reconnect_with(
    id: AgentIntegrationId,
    mut run: impl FnMut(Vec<OsString>) -> bool,
) -> bool {
    if id == AgentIntegrationId::Codex {
        // Evict the exact stale app-owned cache before reinstalling. A missing
        // installation is harmless because the following add recreates it.
        let _ = run(remove_args(id));
    }
    run(install_args(id)) || run(update_args(id))
}

fn install_args(id: AgentIntegrationId) -> Vec<OsString> {
    let plugin = plugin_selector(id);
    match id {
        AgentIntegrationId::Codex => vec!["plugin".into(), "add".into(), plugin.into()],
        AgentIntegrationId::ClaudeCode
        | AgentIntegrationId::GithubCopilot
        | AgentIntegrationId::Cursor => {
            vec!["plugin".into(), "install".into(), plugin.into()]
        }
        AgentIntegrationId::OpenCode => Vec::new(),
    }
}

fn update_args(id: AgentIntegrationId) -> Vec<OsString> {
    let plugin = plugin_selector(id);
    match id {
        AgentIntegrationId::Codex => vec!["plugin".into(), "add".into(), plugin.into()],
        AgentIntegrationId::ClaudeCode
        | AgentIntegrationId::GithubCopilot
        | AgentIntegrationId::Cursor => {
            vec!["plugin".into(), "update".into(), plugin.into()]
        }
        AgentIntegrationId::OpenCode => Vec::new(),
    }
}

fn remove_args(id: AgentIntegrationId) -> Vec<OsString> {
    let plugin = plugin_selector(id);
    remove_plugin_args(id, plugin)
}

fn remove_plugin_args(id: AgentIntegrationId, plugin: String) -> Vec<OsString> {
    match id {
        AgentIntegrationId::Codex => vec!["plugin".into(), "remove".into(), plugin.into()],
        AgentIntegrationId::ClaudeCode
        | AgentIntegrationId::GithubCopilot
        | AgentIntegrationId::Cursor => {
            vec!["plugin".into(), "uninstall".into(), plugin.into()]
        }
        AgentIntegrationId::OpenCode => Vec::new(),
    }
}

fn legacy_plugin_selector(marketplace: &str) -> String {
    format!("{LEGACY_PLUGIN_NAME}@{marketplace}")
}

pub(super) fn plugin_selector(id: AgentIntegrationId) -> String {
    format!("{PLUGIN_NAME}@{}", marketplace_name(id))
}
