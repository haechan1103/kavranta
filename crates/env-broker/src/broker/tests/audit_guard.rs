use super::*;

#[test]
fn broker_exposes_no_account_storage_or_permission_capability() {
    let definitions = tool_definitions();
    let names = definitions
        .as_array()
        .expect("tool definitions")
        .iter()
        .filter_map(|tool| tool.get("name").and_then(Value::as_str))
        .collect::<Vec<_>>();

    for forbidden in [
        "list_accounts",
        "create_account",
        "update_account",
        "delete_account",
        "set_account_project_access",
        "copy_account_field",
        "run_login_test",
    ] {
        assert!(
            !names.contains(&forbidden),
            "unexpected Broker capability: {forbidden}"
        );
    }
}

#[test]
fn broker_exposes_a_closed_action_pack_install_plan_schema() {
    let definitions = tool_definitions();
    let tool = definitions
        .as_array()
        .expect("tool definitions")
        .iter()
        .find(|tool| tool["name"] == "plan_install_action_pack")
        .expect("Action Pack install tool");
    let schema = &tool["inputSchema"];

    assert_eq!(schema["additionalProperties"], false);
    assert!(schema["properties"]["manifest"]["oneOf"].is_array());
    assert!(schema["properties"].get("command").is_none());
    assert!(schema["properties"].get("value").is_none());
}

#[test]
fn registered_discovery_tools_expose_only_bounded_redacted_queries() {
    let definitions = tool_definitions();
    let definitions = definitions.as_array().expect("tool definitions");
    let project_tool = definitions
        .iter()
        .find(|tool| tool["name"] == "find_registered_projects")
        .expect("registered project tool");
    let variable_tool = definitions
        .iter()
        .find(|tool| tool["name"] == "search_registered_variable_sources")
        .expect("registered variable tool");

    assert_eq!(project_tool["inputSchema"]["additionalProperties"], false);
    assert_eq!(
        project_tool["inputSchema"]["properties"]["limit"]["maximum"],
        25
    );
    assert_eq!(variable_tool["inputSchema"]["additionalProperties"], false);
    assert_eq!(
        variable_tool["inputSchema"]["properties"]["limit"]["maximum"],
        50
    );
    for forbidden in ["value", "sourceLine", "command", "path"] {
        assert!(
            variable_tool["inputSchema"]["properties"]
                .get(forbidden)
                .is_none()
        );
    }
    assert_eq!(
        audit_category("find_registered_projects", "redacted-project-lookup"),
        "structure-inspection"
    );
    assert_eq!(
        audit_category(
            "search_registered_variable_sources",
            "redacted-cross-project-search"
        ),
        "structure-inspection"
    );
}

#[test]
fn android_app_links_tool_accepts_only_semantic_identifiers() {
    let definitions = tool_definitions();
    let tool = definitions
        .as_array()
        .expect("tool definitions")
        .iter()
        .find(|tool| tool["name"] == "verify_android_app_links")
        .expect("Android App Links tool");
    let properties = &tool["inputSchema"]["properties"];

    assert_eq!(tool["inputSchema"]["additionalProperties"], false);
    for forbidden in [
        "value",
        "fingerprint",
        "candidate",
        "url",
        "body",
        "command",
    ] {
        assert!(properties.get(forbidden).is_none());
    }
    assert_eq!(properties["hosts"]["maxItems"], 10);
    assert_eq!(
        audit_category(
            "verify_android_app_links",
            "opaque-public-fingerprint-verification"
        ),
        "provider-compare"
    );
}

#[test]
fn audit_schema_contains_only_allowlisted_metadata() {
    let paths = vec![".env.local".to_owned()];
    let keys = vec!["GPT_API_KEY".to_owned()];
    let event = AuditEvent {
        timestamp_ms: 1,
        project_id: "synthetic-project",
        actor: "claude-code".to_owned(),
        category: audit_category("read_allowed_value", "policy-checked"),
        operation: "read_allowed_value",
        relative_paths: &paths,
        variable_names: &keys,
        policy_decision: "policy-checked",
        outcome: "blocked",
        result_code: "CODEX_ACCESS_BLOCKED",
    };
    let serialized = serde_json::to_string(&event).expect("serialize audit event");
    assert!(serialized.contains("claude-code"));
    assert!(serialized.contains("GPT_API_KEY"));
    assert!(!serialized.contains(CANARY));
    for forbidden_field in ["value", "valueFragment", "replacement", "valueHash"] {
        assert!(!serialized.contains(&format!("\"{forbidden_field}\"")));
    }
}

#[test]
fn audit_uses_app_data_without_plugin_environment_and_identifies_mcp_client() {
    let app_data = tempfile::tempdir().expect("app data");
    let project = SyntheticProject::new();
    project.write(".env.local", "CLIENT_MODE=fake_client_value\n");
    let service = ProjectService::open(project.root()).expect("project service");
    service.initialize().expect("initialize project");
    let project_id = service.project_id().to_owned();
    let broker = Broker::with_registered_roots_and_app_data(
        vec![project.root().to_path_buf()],
        app_data.path().to_path_buf(),
    );
    broker.identify_client("codex-mcp-client");

    broker
        .call_tool(
            "inspect_project",
            json!({ "projectPath": project.root().to_string_lossy() }),
        )
        .expect("inspect through broker");

    let audit = fs::read_to_string(
        app_data
            .path()
            .join("agent-activity")
            .join(format!("{project_id}.jsonl")),
    )
    .expect("app-owned audit log");
    assert!(audit.contains(r#""actor":"codex""#));
    assert!(audit.contains(r#""operation":"inspect_project""#));
    assert!(!audit.contains("fake_client_value"));
}

#[test]
fn guard_denies_direct_env_paths_without_echoing_input() {
    let input = json!({
        "hook_event_name": "PreToolUse",
        "tool_name": "Read",
        "tool_input": {
            "file_path": "/tmp/project/.env.local",
            "content": CANARY
        }
    });

    let decision = guard_hook_decision(&input).to_string();

    assert!(decision.contains("\"permissionDecision\":\"deny\""));
    assert!(!decision.contains(CANARY));
    assert!(!decision.contains("/tmp/project"));
}

#[test]
fn cursor_guard_uses_cursor_permission_schema_without_echoing_input() {
    let denied = json!({
        "hook_event_name": "preToolUse",
        "cursor_version": "2.6.0",
        "tool_name": "Read",
        "tool_input": {
            "path": "/tmp/project/.env.local",
            "content": CANARY
        }
    });
    let allowed = json!({
        "hook_event_name": "preToolUse",
        "cursor_version": "2.6.0",
        "tool_name": "Read",
        "tool_input": { "path": "/tmp/project/src/main.rs" }
    });

    let decision = guard_hook_decision(&denied);
    assert_eq!(decision["permission"], "deny");
    assert!(!decision.to_string().contains(CANARY));
    assert!(!decision.to_string().contains("/tmp/project"));
    assert_eq!(guard_hook_decision(&allowed)["permission"], "allow");
}

#[test]
fn cursor_file_context_and_tab_guards_block_supported_env_names_without_echoing_content() {
    for (event, path) in [
        ("beforeReadFile", "/tmp/project/secrets/runtime.env.staging"),
        (
            "beforeTabFileRead",
            "C:\\fake-project\\workers\\.dev.vars.preview",
        ),
    ] {
        let denied = json!({
            "hook_event_name": event,
            "cursor_version": "2.6.0",
            "file_path": path,
            "content": CANARY,
            "attachments": [{ "type": "file", "file_path": path }]
        });
        let decision = guard_hook_decision(&denied);

        assert_eq!(decision["permission"], "deny");
        assert!(!decision.to_string().contains(CANARY));
        assert!(!decision.to_string().contains("project"));
    }
}

#[test]
fn cursor_file_guards_ignore_non_path_content_and_allow_source_files() {
    for event in ["beforeReadFile", "beforeTabFileRead"] {
        let allowed = json!({
            "hook_event_name": event,
            "cursor_version": "2.6.0",
            "file_path": "/tmp/project/src/main.rs",
            "content": "Documentation can mention .env.local and runtime.env safely."
        });

        assert_eq!(
            guard_hook_decision(&allowed),
            json!({ "permission": "allow" })
        );
    }
}

#[test]
fn guard_denies_shell_and_patch_env_access() {
    for input in [
        json!({
            "tool_name": "Bash",
            "tool_input": { "command": "sed -n 1,20p apps/web/.env.development" }
        }),
        json!({
            "tool_name": "apply_patch",
            "tool_input": { "patch": "*** Update File: .env\n" }
        }),
        json!({
            "toolName": "create_file",
            "toolInput": { "filePath": "C:\\fake-project\\.env.local" }
        }),
        json!({
            "tool_name": "Write",
            "tool_input": { "file_path": "workers/api/.dev.vars.production" }
        }),
        json!({
            "tool_name": "Read",
            "tool_input": { "file_path": "secrets/mobile/runtime.env.production" }
        }),
        json!({
            "tool_name": "Grep",
            "tool_input": { "glob": "**/*.env*" }
        }),
    ] {
        assert_eq!(
            guard_hook_decision(&input)["hookSpecificOutput"]["permissionDecision"],
            "deny"
        );
    }
}

#[test]
fn guard_allows_source_patch_that_only_mentions_env_paths_in_changed_lines() {
    let runtime_file = ["runtime.", "env", ".staging"].concat();
    let dotenv_file = [".", "env", ".local"].concat();
    let wrangler_file = [".dev", ".vars", ".preview"].concat();
    for input in [
        json!({
            "tool_name": "apply_patch",
            "tool_input": {
                "patch": format!(
                    "*** Begin Patch\n*** Update File: deploy.sh\n@@\n-verify --env-file {runtime_file}\n+verify --env-file {runtime_file} --strict\n*** End Patch\n"
                )
            }
        }),
        json!({
            "toolName": "ApplyPatch",
            "toolInput": {
                "patchText": format!(
                    "*** Begin Patch\r\n*** Update File: docs/deployment.md\r\n@@\r\n-Use {dotenv_file}\r\n+Use {wrangler_file}\r\n*** End Patch\r\n"
                )
            }
        }),
    ] {
        assert_eq!(guard_hook_decision(&input), json!({}));
    }
}

#[test]
fn guard_blocks_patch_when_any_declared_target_is_env_data() {
    let targets = [
        ("Update File", [".", "env", ".local"].concat()),
        (
            "Add File",
            ["workers/api/.dev", ".vars", ".preview"].concat(),
        ),
        (
            "Delete File",
            ["secrets/runtime.", "env", ".staging"].concat(),
        ),
    ];
    for (operation, target) in targets {
        let input = json!({
            "tool_name": "apply_patch",
            "tool_input": {
                "patch": format!(
                    "*** Begin Patch\n*** {operation}: {target}\n@@\n-old\n+new\n*** End Patch\n"
                )
            }
        });
        assert_guard_denies(input);
    }

    let move_target = ["config/runtime.", "env", ".production"].concat();
    assert_guard_denies(json!({
        "tool_name": "apply_patch",
        "tool_input": {
            "patch": format!(
                "*** Begin Patch\n*** Update File: deploy.sh\n*** Move to: {move_target}\n@@\n-old\n+new\n*** End Patch\n"
            )
        }
    }));

    let mixed_target = ["config/.", "env", ".production"].concat();
    assert_guard_denies(json!({
        "tool_name": "apply_patch",
        "tool_input": {
            "patch": format!(
                "*** Begin Patch\n*** Update File: deploy.sh\n@@\n-old\n+new\n*** Update File: {mixed_target}\n@@\n-old\n+new\n*** End Patch\n"
            )
        }
    }));
}

#[test]
fn guard_fails_closed_for_unparseable_patch_that_mentions_an_env_path() {
    let target = [".", "env", ".local"].concat();
    let input = json!({
        "tool_name": "apply_patch",
        "tool_input": {
            "patch": format!("*** Begin Patch\n@@\n+Read {target} directly\n*** End Patch\n")
        }
    });

    assert_guard_denies(input);
}

fn assert_guard_denies(input: Value) {
    assert_eq!(
        guard_hook_decision(&input)["hookSpecificOutput"]["permissionDecision"],
        "deny"
    );
}

#[test]
fn guard_allows_unrelated_source_operations_and_env_mentions_in_content() {
    for input in [
        json!({
            "tool_name": "Read",
            "tool_input": { "file_path": "src/main.ts" }
        }),
        json!({
            "tool_name": "Read",
            "tool_input": { "file_path": ".env-manager.json" }
        }),
        json!({
            "tool_name": "Write",
            "tool_input": {
                "file_path": "README.md",
                "content": "Document .env.local without opening it"
            }
        }),
        json!({
            "tool_name": "Bash",
            "tool_input": { "command": "npm test" }
        }),
        json!({
            "tool_name": "Bash",
            "tool_input": {
                "command": "openssl rand -base64 32 | kavranta-broker value apply-stdin --plan stdin-plan-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef --trim-final-newline"
            }
        }),
    ] {
        assert_eq!(guard_hook_decision(&input), json!({}));
    }
}

#[cfg(unix)]
#[test]
fn personal_provider_push_keeps_the_value_out_of_agent_arguments_and_results() {
    use std::os::unix::fs::PermissionsExt;

    let (project, _) = registered_project();
    let app_data = tempfile::tempdir().expect("app data");
    let pack_source = tempfile::tempdir().expect("pack source");
    let runner_dir = tempfile::tempdir().expect("runner");
    let executable = runner_dir.path().join("fake-provider");
    let args_capture = runner_dir.path().join("args.txt");
    let stdin_capture = runner_dir.path().join("stdin.txt");
    fs::write(
            &executable,
            "#!/bin/sh\nif [ \"$1\" = \"--version\" ]; then printf '1.2.3\\n'; exit 0; fi\nargs_file=$1\nstdin_file=$2\nshift 2\nprintf '%s\\n' \"$@\" > \"$args_file\"\ncat > \"$stdin_file\"\n",
        )
        .expect("runner");
    let mut permissions = fs::metadata(&executable).expect("metadata").permissions();
    permissions.set_mode(0o700);
    fs::set_permissions(&executable, permissions).expect("permissions");
    fs::write(
        pack_source.path().join("provider.json"),
        serde_json::to_vec_pretty(&json!({
            "schemaVersion": 1,
            "id": "local.test.capture",
            "displayName": "Capture Provider",
            "description": "Synthetic provider",
            "version": "1.0.0",
            "providerProtocolVersion": "0.2.0",
            "valueTransport": "stdin",
            "target": { "label": "Application", "placeholder": "target" },
            "cli": {
                "executableCandidates": [executable.to_string_lossy()],
                "versionArgs": ["--version"],
                "profiles": [{
                    "id": "capture-v1",
                    "versionRequirement": ">=1.0.0,<2.0.0",
                    "pushArgs": [
                        args_capture.to_string_lossy(),
                        stdin_capture.to_string_lossy(),
                        "push", "{key}", "--app", "{target}"
                    ]
                }]
            }
        }))
        .expect("manifest"),
    )
    .expect("write manifest");
    env_provider::personal_provider::install(pack_source.path(), app_data.path(), false)
        .expect("install pack");

    let broker = Broker::with_registered_roots_and_app_data(
        vec![project.root().to_path_buf()],
        app_data.path().to_path_buf(),
    );
    let plan = broker
        .call_tool(
            "plan_provider_push",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "provider": "local.test.capture",
                "file": ".env.local",
                "selections": [{ "key": "GPT_API_KEY", "kind": "secret" }],
                "personalTarget": "fake-app"
            }),
        )
        .expect("provider plan");
    assert!(!plan.to_string().contains(CANARY));
    let plan_id = plan.get("planId").and_then(Value::as_str).expect("plan id");
    let result = broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("provider apply");
    assert!(!result.to_string().contains(CANARY));
    assert_eq!(fs::read_to_string(stdin_capture).expect("stdin"), CANARY);
    let arguments = fs::read_to_string(args_capture).expect("args");
    assert!(arguments.contains("GPT_API_KEY"));
    assert!(arguments.contains("fake-app"));
    assert!(!arguments.contains(CANARY));
}
