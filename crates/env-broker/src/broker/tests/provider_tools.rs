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
fn action_pack_v2_body_is_allowlisted_and_never_carries_the_secret() {
    let (project, service) = registered_project();
    let app_data = tempfile::tempdir().expect("app data");
    let listener = TcpListener::bind("127.0.0.1:0").expect("listener");
    let address = listener.local_addr().expect("address");
    let manifest = json!({
        "schemaVersion": 1,
        "id": "local.test.chat-gateway",
        "displayName": "Chat gateway",
        "description": "Synthetic credential-bound call",
        "packVersion": "1.0.0",
        "actionProtocolVersion": "0.2.0",
        "type": "http",
        "method": "POST",
        "url": format!("http://{address}/v1/chat"),
        "secretBindings": {
            "Authorization": { "source": "header", "format": "Bearer {value}" }
        },
        "requestBody": { "contentType": "json", "fields": ["model", "messages"] },
        "responseProjection": {
            "contentType": "json",
            "fields": { "content": "choices.0.message.content", "echo": "echo" },
            "maxBytes": 4096
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
        let mut request = [0_u8; 8192];
        let size = stream.read(&mut request).expect("read");
        let request = String::from_utf8_lossy(&request[..size]).to_string();
        assert!(request.contains("\"model\":\"fake/model\""));
        assert!(
            request
                .to_ascii_lowercase()
                .contains("authorization: bearer")
        );
        let body = format!(
            "{{\"choices\":[{{\"message\":{{\"content\":\"hello from model\"}}}}],\"echo\":\"{CANARY}\"}}"
        );
        write!(
            stream,
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
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
    let install_plan_id = install_plan["planId"].as_str().expect("install plan id");
    broker
        .call_tool("apply_plan", json!({ "planId": install_plan_id }))
        .expect("install Action Pack");

    let plan = broker
        .call_tool(
            "plan_action",
            json!({
                "projectPath": project.root(),
                "packId": "local.test.chat-gateway",
                "file": ".env.local",
                "bindings": { "Authorization": "GPT_API_KEY" },
                "body": "{\"model\":\"fake/model\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"
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
    assert_eq!(result["output"]["content"], "hello from model");
    assert_eq!(result["output"]["echo"], "[redacted]");
    assert!(!result.to_string().contains(CANARY));

    let rejected = broker.call_tool(
        "plan_action",
        json!({
            "projectPath": project.root(),
            "packId": "local.test.chat-gateway",
            "file": ".env.local",
            "bindings": { "Authorization": "GPT_API_KEY" },
            "body": "{\"model\":\"fake/model\",\"evil\":true}"
        }),
    );
    assert!(rejected.is_err());
}

#[test]
fn exposure_scan_returns_paths_and_counts_without_values() {
    let (project, service) = registered_project();
    project.write(
        "credentials.json",
        "{\"client_email\":\"fake_demo@example.com\",\"private_key\":\"fake_key\"}\n",
    );
    let app_data = tempfile::tempdir().expect("app data");
    let broker = Broker::with_registered_roots_and_app_data(
        vec![service.root().to_path_buf()],
        app_data.path().to_path_buf(),
    );

    let result = broker
        .call_tool("scan_exposure", json!({ "projectPath": project.root() }))
        .expect("scan exposure");

    assert_eq!(result["state"], "scanned");
    assert!(result["counts"]["allowed"].as_u64().unwrap_or(0) >= 1);
    assert!(result["counts"]["certain"].as_u64().unwrap_or(0) >= 1);
    assert!(
        result["findings"]
            .as_array()
            .expect("findings")
            .iter()
            .any(|finding| finding["path"] == "credentials.json"
                && finding["disposition"] == "exposed")
    );
    assert!(
        result["findings"]
            .as_array()
            .expect("findings")
            .iter()
            .any(|finding| finding["path"] == ".env.local"
                && finding["disposition"] == "allowed"
                && finding["reason"] == "ai-allowed-variable")
    );
    let serialized = result.to_string();
    assert!(!serialized.contains(CANARY));
    assert!(!serialized.contains("private_key"));
}

#[cfg(unix)]
#[test]
fn request_value_input_sends_names_only_and_returns_outcomes() {
    use std::io::{BufRead, BufReader, Write};
    use std::os::unix::net::UnixListener;

    let (project, service) = registered_project();
    let app_data = tempfile::tempdir().expect("app data");
    let socket = env_core::secret_input_socket_path(app_data.path());
    let listener = UnixListener::bind(&socket).expect("socket");
    let server = std::thread::spawn(move || {
        let (mut stream, _) = listener.accept().expect("accept");
        let mut reader = BufReader::new(stream.try_clone().expect("clone"));
        let mut line = String::new();
        reader.read_line(&mut line).expect("read request");
        let request: env_core::SecretInputRequest =
            serde_json::from_str(line.trim()).expect("request json");
        assert_eq!(request.entries[0].name, "GEMINI_API_KEY");
        assert!(!line.contains("="));
        let response = env_core::SecretInputResponse::all(
            &request.request_id,
            &["GEMINI_API_KEY".to_owned()],
            env_core::SecretInputOutcome::Added,
        );
        stream
            .write_all(
                serde_json::to_string(&response)
                    .expect("response")
                    .as_bytes(),
            )
            .expect("write response");
        stream.write_all(b"\n").expect("newline");
    });
    let broker = Broker::with_registered_roots_and_app_data(
        vec![service.root().to_path_buf()],
        app_data.path().to_path_buf(),
    );

    let result = broker
        .call_tool(
            "request_value_input",
            json!({
                "projectPath": project.root(),
                "entries": [{ "name": "GEMINI_API_KEY", "file": ".env.local" }]
            }),
        )
        .expect("request value input");
    server.join().expect("server");

    assert_eq!(result["results"][0]["name"], "GEMINI_API_KEY");
    assert_eq!(result["results"][0]["outcome"], "added");
    assert!(!result.to_string().contains(CANARY));
}

#[test]
fn plan_set_variable_guide_writes_a_value_free_guide() {
    let (project, service) = registered_project();
    let app_data = tempfile::tempdir().expect("app data");
    let broker = Broker::with_registered_roots_and_app_data(
        vec![service.root().to_path_buf()],
        app_data.path().to_path_buf(),
    );

    let plan = broker
        .call_tool(
            "plan_set_variable_guide",
            json!({
                "projectPath": project.root(),
                "key": "GPT_API_KEY",
                "markdown": "# Guide\n\nOpen the console to get the key."
            }),
        )
        .expect("plan guide");
    let plan_id = plan["planId"].as_str().expect("plan id");
    broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("apply guide");

    let guide_path = service.root().join(".env-manager/guides/GPT_API_KEY.md");
    assert!(guide_path.is_file());
    let text = std::fs::read_to_string(&guide_path).expect("guide text");
    assert!(text.contains("Open the console"));
    assert!(!text.contains(CANARY));

    let inspect = broker
        .call_tool("inspect_project", json!({ "projectPath": project.root() }))
        .expect("inspect");
    let has_guide = inspect["files"]
        .as_array()
        .and_then(|files| files.first())
        .and_then(|file| file["groups"].as_array())
        .and_then(|groups| groups.first())
        .and_then(|group| group["variables"].as_array())
        .map(|variables| {
            variables
                .iter()
                .any(|variable| variable["key"] == "GPT_API_KEY" && variable["hasGuide"] == true)
        })
        .unwrap_or(false);
    assert!(has_guide);
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
