use std::ffi::OsString;

use super::super::marketplace::{
    cleanup_legacy_connections_with, plugin_selector, refresh_after_marketplace_reconnect_with,
    stage_owned_codex_marketplace_with,
};
use super::super::model::{AgentIntegrationId, CodexMarketplaceAlias, marketplace_name};

#[test]
fn codex_uses_the_kavranta_owned_marketplace_identity() {
    assert_eq!(
        plugin_selector(AgentIntegrationId::Codex),
        "kavranta@kavranta-desktop"
    );
    assert_eq!(
        marketplace_name(AgentIntegrationId::Codex),
        "kavranta-desktop"
    );
}

#[test]
fn claude_and_copilot_use_the_kavranta_marketplace_identity() {
    for id in [
        AgentIntegrationId::ClaudeCode,
        AgentIntegrationId::GithubCopilot,
    ] {
        assert_eq!(plugin_selector(id), "kavranta@kavranta");
    }
}

#[test]
fn codex_repair_evicts_only_the_new_plugin_before_reinstalling() {
    let mut commands = Vec::new();
    let refreshed = refresh_after_marketplace_reconnect_with(AgentIntegrationId::Codex, |args| {
        commands.push(args);
        true
    });

    assert!(refreshed);
    assert_eq!(
        commands,
        vec![
            vec![
                OsString::from("plugin"),
                OsString::from("remove"),
                OsString::from("kavranta@kavranta-desktop"),
            ],
            vec![
                OsString::from("plugin"),
                OsString::from("add"),
                OsString::from("kavranta@kavranta-desktop"),
            ],
        ]
    );
}

#[test]
fn codex_stage_never_removes_the_legacy_plugin() {
    let catalog = OsString::from("/catalogs/2.0.0/codex");
    let mut commands = Vec::new();

    assert!(stage_owned_codex_marketplace_with(
        catalog.clone(),
        |args| {
            commands.push(args);
            true
        }
    ));

    assert_eq!(
        commands,
        vec![
            vec![
                OsString::from("plugin"),
                OsString::from("remove"),
                OsString::from("kavranta@kavranta-desktop"),
            ],
            vec![
                OsString::from("plugin"),
                OsString::from("marketplace"),
                OsString::from("remove"),
                OsString::from("kavranta-desktop"),
            ],
            vec![
                OsString::from("plugin"),
                OsString::from("marketplace"),
                OsString::from("add"),
                catalog,
            ],
            vec![
                OsString::from("plugin"),
                OsString::from("add"),
                OsString::from("kavranta@kavranta-desktop"),
            ],
        ]
    );
    assert!(!commands.iter().any(|args| {
        args.iter()
            .any(|value| value.to_string_lossy().contains("env-manager"))
    }));
}

#[test]
fn codex_stage_requires_new_marketplace_and_plugin_install() {
    let mut add_marketplace_attempted = false;
    let staged =
        stage_owned_codex_marketplace_with(OsString::from("/catalogs/2.0.0/codex"), |args| {
            if args.get(1).is_some_and(|value| value == "marketplace")
                && args.get(2).is_some_and(|value| value == "add")
            {
                add_marketplace_attempted = true;
                return false;
            }
            true
        });

    assert!(!staged);
    assert!(add_marketplace_attempted);
}

#[test]
fn codex_cleanup_removes_only_verified_legacy_aliases() {
    let aliases = vec![CodexMarketplaceAlias {
        name: "env-manager-desktop".to_owned(),
        remove_marketplace: true,
    }];
    let mut commands = Vec::new();

    let cleaned = cleanup_legacy_connections_with(
        AgentIntegrationId::Codex,
        &aliases,
        &["env-manager-desktop".to_owned()],
        |args| {
            commands.push(args);
            true
        },
    );

    assert!(cleaned);
    assert!(commands.contains(&vec![
        OsString::from("plugin"),
        OsString::from("remove"),
        OsString::from("env-manager@env-manager-desktop"),
    ]));
    assert!(
        !commands
            .iter()
            .flatten()
            .any(|argument| argument == "personal")
    );
    assert!(commands.contains(&vec![
        OsString::from("plugin"),
        OsString::from("marketplace"),
        OsString::from("remove"),
        OsString::from("env-manager-desktop"),
    ]));
    assert!(!commands.contains(&vec![
        OsString::from("plugin"),
        OsString::from("marketplace"),
        OsString::from("remove"),
        OsString::from("personal"),
    ]));
}

#[test]
fn claude_cleanup_uses_the_legacy_selector_only_after_official_detection() {
    let mut ignored_commands = Vec::new();
    let cleaned =
        cleanup_legacy_connections_with(AgentIntegrationId::ClaudeCode, &[], &[], |args| {
            ignored_commands.push(args);
            true
        });
    assert!(cleaned);
    assert!(ignored_commands.is_empty());

    let mut commands = Vec::new();
    let cleaned = cleanup_legacy_connections_with(
        AgentIntegrationId::ClaudeCode,
        &[],
        &["env-manager".to_owned()],
        |args| {
            commands.push(args);
            true
        },
    );
    assert!(cleaned);
    assert_eq!(commands[0][2], "env-manager@env-manager");
    assert_eq!(commands.len(), 1);
}

#[test]
fn failed_legacy_cleanup_is_reported_for_retry() {
    let cleaned = cleanup_legacy_connections_with(
        AgentIntegrationId::ClaudeCode,
        &[],
        &["env-manager".to_owned()],
        |_| false,
    );

    assert!(!cleaned);
}
