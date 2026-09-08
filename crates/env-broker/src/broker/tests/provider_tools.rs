use super::*;

#[test]
fn action_pack_plan_and_result_never_cross_the_broker_with_the_secret() {
    let (project, service) = registered_project();
    let app_data = tempfile::tempdir().expect("app data");
    let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
    let address = listener.local_addr().expect("address");
    let manifest = json!({
        "schemaVersion": 1,
        "id": "local.test.api-check",
        "displayName": "API check",
        "description": "Synthetic action",
        "packVersion": "1.0.0",
        "actionProtocolVersion": "0.1.0",
        "type": "http",
        "method": "GET",
        "url": format!("http://{address}/health"),
        "secretBindings": {
            "Authorization": {
                "source": "header",
                "format": "Bearer {value}"
            }
        },
        "resultPolicy": {
            "status": true,
            "duration": true,
            "body": false,
            "successStatusCodes": [200]
        },
        "timeoutSeconds": 5
    });
    let server = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept");
        let mut request = [0_u8; 4096];
        let size = stream.read(&mut request).expect("read");
        let request = String::from_utf8_lossy(&request[..size]).to_ascii_lowercase();
        assert!(request.contains(&format!("authorization: bearer {CANARY}").to_ascii_lowercase()));
        write!(
            stream,
            "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            CANARY.len(),
            CANARY
        )
        .expect("respond");
    });
    let broker = Broker::with_registered_roots_and_app_data(
        vec![service.root().to_path_buf()],
        app_data.path().to_path_buf(),
    );

    let install_plan = broker
        .call_tool(
            "plan_install_action_pack",
            json!({
                "projectPath": project.root(),
                "manifest": manifest,
                "replace": false
            }),
        )
        .expect("plan Action Pack install");
    assert_eq!(install_plan["risk"], "local-action-pack-install");
    assert!(!install_plan.to_string().contains(CANARY));
    let install_plan_id = install_plan["planId"].as_str().expect("install plan id");
    let installed = broker
        .call_tool("apply_plan", json!({ "planId": install_plan_id }))
        .expect("install Action Pack");
    assert_eq!(installed["id"], "local.test.api-check");
    assert!(!installed.to_string().contains(CANARY));

    let packs = broker
        .call_tool(
            "list_action_packs",
            json!({ "projectPath": project.root() }),
        )
        .expect("list packs");
    assert!(!packs.to_string().contains(CANARY));
    let plan = broker
        .call_tool(
            "plan_action",
            json!({
                "projectPath": project.root(),
                "packId": "local.test.api-check",
                "file": ".env.local",
                "bindings": { "Authorization": "GPT_API_KEY" }
            }),
        )
        .expect("plan action");
    assert!(!plan.to_string().contains(CANARY));
    let plan_id = plan["planId"].as_str().expect("plan id");
    let result = broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("apply action");
    server.join().expect("server");

    assert_eq!(result["succeeded"], true);
    assert_eq!(result["statusCode"], 200);
    assert!(!result.to_string().contains(CANARY));
    let audit = fs::read_to_string(
        app_data
            .path()
            .join("agent-activity")
            .join(format!("{}.jsonl", service.project_id())),
    )
    .expect("Action audit");
    assert!(audit.contains("local-action-pack-install"));
    assert!(audit.contains("opaque-action-pack"));
    assert!(!audit.contains(CANARY));
}

#[test]
fn action_pack_install_plan_validates_manifest_and_replace_intent() {
    let (project, service) = registered_project();
    let app_data = tempfile::tempdir().expect("app data");
    let broker = Broker::with_registered_roots_and_app_data(
        vec![service.root().to_path_buf()],
        app_data.path().to_path_buf(),
    );
    let manifest = json!({
        "schemaVersion": 1,
        "id": "local.test.install-check",
        "displayName": "Install check",
        "description": "Synthetic install-only action",
        "packVersion": "1.0.0",
        "actionProtocolVersion": "0.1.0",
        "type": "http",
        "method": "HEAD",
        "url": "https://api.example.test/health",
        "secretBindings": {
            "Authorization": {
                "source": "header",
                "format": "Bearer {value}"
            }
        },
        "resultPolicy": {
            "status": true,
            "duration": true,
            "body": false,
            "successStatusCodes": [200]
        },
        "timeoutSeconds": 5
    });

    let plan = broker
        .call_tool(
            "plan_install_action_pack",
            json!({
                "projectPath": project.root(),
                "manifest": manifest.clone()
            }),
        )
        .expect("plan initial install");
    let plan_id = plan["planId"].as_str().expect("install plan id");
    broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("apply initial install");

    let duplicate = broker
        .call_tool(
            "plan_install_action_pack",
            json!({
                "projectPath": project.root(),
                "manifest": manifest.clone(),
                "replace": false
            }),
        )
        .expect_err("duplicate install without replace");
    assert!(duplicate.to_string().contains("ACTION_PACK_EXISTS"));

    let replace_plan = broker
        .call_tool(
            "plan_install_action_pack",
            json!({
                "projectPath": project.root(),
                "manifest": manifest,
                "replace": true
            }),
        )
        .expect("plan explicit replacement");
    let replace_plan_id = replace_plan["planId"].as_str().expect("replace plan id");
    broker
        .call_tool("apply_plan", json!({ "planId": replace_plan_id }))
        .expect("apply replacement");

    let unsafe_manifest = json!({
        "schemaVersion": 1,
        "id": "local.test.unsafe-shell",
        "displayName": "Unsafe shell",
        "description": "Synthetic rejected action",
        "packVersion": "1.0.0",
        "actionProtocolVersion": "0.1.0",
        "type": "cli",
        "executableCandidates": ["bash"],
        "versionArgs": ["--version"],
        "profiles": [{
            "id": "shell-v1",
            "versionRequirement": ">=1",
            "arguments": ["run"]
        }],
        "secretBinding": "value",
        "secretTransport": "stdin",
        "resultPolicy": { "success": true, "exitCode": true, "duration": true },
        "timeoutSeconds": 5
    });
    let unsafe_result = broker.call_tool(
        "plan_install_action_pack",
        json!({
            "projectPath": project.root(),
            "manifest": unsafe_manifest
        }),
    );
    assert!(unsafe_result.is_err());
}

#[test]
fn team_channel_listing_returns_ciphertext_metadata_only() {
    let (project, service) = registered_project();
    let app_data = tempfile::tempdir().expect("app data");
    let shared = tempfile::tempdir().expect("shared folder");
    let channel = env_team::connect_folder_transport(shared.path(), "Synthetic team")
        .expect("connect synthetic channel");
    let env_team::TeamChannelTransportConfig::Folder { channel_id, .. } = &channel.transport;
    let transport = env_team::open_transport(&channel.transport).expect("transport");
    let package = transport
        .publish(&mut std::io::Cursor::new(
            b"fake ciphertext without env values",
        ))
        .expect("synthetic ciphertext");
    let package_id = package.id;
    fs::write(
        app_data.path().join("projects.json"),
        serde_json::to_vec(&json!({
            "projects": [{
                "id": service.project_id(),
                "name": "Synthetic project",
                "displayPath": project.root().to_string_lossy(),
                "root": project.root(),
                "fileLabels": {},
            }],
            "teamChannels": [{
                "id": "folder_local_12345678",
                "projectId": service.project_id(),
                "channelId": channel_id,
                "name": "Synthetic team",
                "root": shared.path(),
            }]
        }))
        .expect("registry json"),
    )
    .expect("registry");
    let broker = Broker::with_registered_roots_and_app_data(
        vec![project.root().to_path_buf()],
        app_data.path().to_path_buf(),
    );

    let result = broker
        .call_tool(
            "list_team_channels",
            json!({ "projectPath": project.root().to_string_lossy() }),
        )
        .expect("list channels");
    let output = result.to_string();
    assert!(output.contains(&package_id), "{output}");
    assert!(output.contains("requiresHumanPassphrase"));
    assert!(!output.contains(CANARY));
    assert!(!output.contains(&shared.path().to_string_lossy().to_string()));
    assert!(!output.contains("passphrase\":"));
}

#[test]
fn provider_compare_returns_only_redacted_state_for_protected_values() {
    let (project, service) = registered_project();
    let broker = Broker::with_registered_roots(vec![service.root().to_path_buf()]);
    let result = broker
        .call_tool(
            "compare_deployment_values",
            json!({
                "projectPath": project.root(),
                "provider": "github-actions",
                "file": ".env.local",
                "keys": ["GPT_API_KEY"]
            }),
        )
        .expect("redacted provider comparison");

    assert_eq!(result["items"][0]["state"], "unverifiable");
    assert!(!result.to_string().contains(CANARY));
    assert_eq!(
        service
            .codex_access("GPT_API_KEY")
            .expect("protected access"),
        CodexAccess::Protected
    );
}

#[test]
fn android_app_links_rejects_a_generic_secret_before_any_network_request() {
    let (project, service) = registered_project();
    let broker = Broker::with_registered_roots(vec![service.root().to_path_buf()]);
    let file = [".", "env", ".local"].concat();
    let error = broker
        .call_tool(
            "verify_android_app_links",
            json!({
                "projectPath": project.root(),
                "file": file,
                "key": "GPT_API_KEY",
                "packageName": "com.example.app",
                "hosts": ["example.test"]
            }),
        )
        .expect_err("generic secrets are not verifier inputs");

    assert!(
        error
            .to_string()
            .contains("ANDROID_APP_LINKS_KEY_NOT_ELIGIBLE")
    );
    assert!(!error.to_string().contains(CANARY));
    assert_eq!(
        service
            .codex_access("GPT_API_KEY")
            .expect("protected access"),
        CodexAccess::Protected
    );
}

#[test]
fn runtime_target_listing_omits_destination_recipient_and_remote_path() {
    let (project, service) = registered_project();
    let identity = age::x25519::Identity::generate();
    env_provider::runtime_target::save(
        service.root(),
        env_provider::runtime_target::RuntimeTarget {
            id: "mobile-ok-dev".to_owned(),
            display_name: "mobile-ok · dev".to_owned(),
            source_file: ".env.local".to_owned(),
            remote_target_id: "server-mobile-ok-dev".to_owned(),
            recipient: identity.to_public().to_string(),
            transport: env_provider::runtime_target::RuntimeTransport::Ssh {
                destination: "deploy@private.example.test".to_owned(),
            },
        },
    )
    .expect("save target fixture");
    let broker = Broker::with_registered_roots(vec![service.root().to_path_buf()]);
    let result = broker
        .call_tool(
            "list_runtime_targets",
            json!({ "projectPath": project.root() }),
        )
        .expect("list runtime targets");

    assert_eq!(result[0]["id"], "mobile-ok-dev");
    assert_eq!(result[0]["sourceFile"], ".env.local");
    assert_eq!(result[0]["transport"], "SSH");
    let serialized = result.to_string();
    assert!(!serialized.contains("private.example.test"));
    assert!(!serialized.contains("age1"));
    assert!(!serialized.contains("server-mobile-ok-dev"));
}
