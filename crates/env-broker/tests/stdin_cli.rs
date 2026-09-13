use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};

use env_core::ProjectService;
use env_registry::{ProjectRegistration, RegistryData};
use env_test_support::SyntheticProject;
use serde_json::{Value, json};

const GUARD_CANARY: &str = "fake_cursor_guard_canary_7d91";

#[test]
fn cursor_hook_cli_blocks_agent_context_and_tab_env_reads_without_echoing_input() {
    let binary = env!("CARGO_BIN_EXE_kavranta-broker");
    for input in [
        json!({
            "hook_event_name": "preToolUse",
            "cursor_version": "2.6.0",
            "tool_name": "Read",
            "tool_input": { "path": "/tmp/fake-project/.env.local" }
        }),
        json!({
            "hook_event_name": "beforeReadFile",
            "cursor_version": "2.6.0",
            "file_path": "/tmp/fake-project/runtime.env.staging",
            "content": GUARD_CANARY
        }),
        json!({
            "hook_event_name": "beforeTabFileRead",
            "cursor_version": "2.6.0",
            "file_path": "C:\\fake-project\\.dev.vars.preview",
            "content": GUARD_CANARY
        }),
    ] {
        let mut process = Command::new(binary)
            .arg("guard-hook")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .expect("spawn Guard hook");
        serde_json::to_writer(process.stdin.as_mut().expect("Guard stdin"), &input)
            .expect("write Guard input");
        drop(process.stdin.take());

        let output = process.wait_with_output().expect("wait for Guard hook");
        assert!(output.status.success());
        assert!(output.stderr.is_empty());
        let response: Value = serde_json::from_slice(&output.stdout).expect("Guard response");
        assert_eq!(response["permission"], "deny");
        let serialized = String::from_utf8(output.stdout).expect("UTF-8 Guard response");
        assert!(!serialized.contains(GUARD_CANARY));
        assert!(!serialized.contains("fake-project"));
    }
}

#[test]
fn guard_hook_cli_distinguishes_patch_targets_from_changed_line_mentions() {
    let binary = env!("CARGO_BIN_EXE_kavranta-broker");
    let data_name = ["runtime.", "env", ".staging"].concat();
    let source_patch = json!({
        "tool_name": "apply_patch",
        "tool_input": {
            "patch": format!(
                "*** Begin Patch\n*** Update File: deploy.sh\n@@\n-old {data_name}\n+new {data_name}\n*** End Patch\n"
            )
        }
    });
    let data_patch = json!({
        "tool_name": "apply_patch",
        "tool_input": {
            "patch": format!(
                "*** Begin Patch\n*** Update File: {data_name}\n@@\n-old\n+new\n*** End Patch\n"
            )
        }
    });

    for (fixture, denied) in [(&source_patch, false), (&data_patch, true)] {
        let patch = fixture["tool_input"]["patch"]
            .as_str()
            .expect("synthetic patch");
        let patch = patch.replace("+new", &format!("+{GUARD_CANARY}"));
        let mut inputs = Vec::new();
        for field in ["patch", "patchText", "command", "cmd", "input"] {
            inputs.push(json!({
                "tool_name": "apply_patch",
                "tool_input": { field: patch }
            }));
        }
        inputs.push(json!({ "tool_name": "apply_patch", "tool_input": patch }));
        for input in inputs {
            let result = run_guard_hook(binary, &input);
            if denied {
                assert_eq!(result["hookSpecificOutput"]["permissionDecision"], "deny");
            } else {
                assert_eq!(result, json!({}));
            }
            let serialized = result.to_string();
            assert!(!serialized.contains(GUARD_CANARY));
            assert!(!serialized.contains(&data_name));
        }
    }
}

#[test]
fn guard_hook_cli_accepts_codex_prisma_sql_and_native_source_patch_envelopes() {
    let binary = env!("CARGO_BIN_EXE_kavranta-broker");
    for path in [
        "tests/prisma-migration.test.ts",
        "migrations/verify.sql",
        "native/Config.swift",
    ] {
        let patch = format!(
            "*** Begin Patch\n*** Add File: {path}\n+// .env.local .dev.vars.preview {GUARD_CANARY}\n*** End Patch\n"
        );
        for (tool_name, denied) in [("apply_patch", false), ("Bash", true)] {
            let result = run_guard_hook(
                binary,
                &json!({
                    "hook_event_name": "PreToolUse",
                    "tool_name": tool_name,
                    "tool_use_id": "fake_source_patch_call",
                    "cwd": "/tmp/fake-source-project",
                    "tool_input": { "command": patch }
                }),
            );
            assert_eq!(
                result["hookSpecificOutput"]["permissionDecision"] == "deny",
                denied
            );
            let serialized = result.to_string();
            assert!(!serialized.contains(GUARD_CANARY));
            assert!(!serialized.contains(path));
            assert!(!serialized.contains(".env.local"));
            assert!(!serialized.contains("fake_source_patch_call"));
        }
    }
}

fn run_guard_hook(binary: &str, input: &Value) -> Value {
    let mut process = Command::new(binary)
        .arg("guard-hook")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("spawn Guard hook");
    serde_json::to_writer(process.stdin.as_mut().expect("Guard stdin"), input)
        .expect("write Guard input");
    drop(process.stdin.take());

    let output = process.wait_with_output().expect("wait for Guard hook");
    assert!(output.status.success());
    assert!(output.stderr.is_empty());
    serde_json::from_slice(&output.stdout).expect("Guard response")
}

#[test]
fn broker_plan_and_separate_cli_process_complete_an_opaque_stdin_write() {
    let project = SyntheticProject::new();
    project.write(".env.local", "AUTH_SECRET=fake_before\n");
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");
    let app_data = tempfile::tempdir().expect("app data");
    let registry_path = app_data.path().join("projects.json");
    env_registry::write(
        &registry_path,
        &RegistryData {
            projects: vec![ProjectRegistration {
                id: service.project_id().to_owned(),
                name: "Synthetic".to_owned(),
                display_path: service.root().to_string_lossy().into_owned(),
                root: service.root().to_path_buf(),
                file_labels: Default::default(),
            }],
            ..RegistryData::default()
        },
    )
    .expect("registry");

    let binary = env!("CARGO_BIN_EXE_kavranta-broker");
    let mut mcp = Command::new(binary)
        .current_dir(project.root())
        .env("KAVRANTA_APP_DATA_DIR", app_data.path())
        .env("KAVRANTA_REGISTRY_PATH", &registry_path)
        .env("KAVRANTA_AGENT_HOST", "codex")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn MCP broker");
    let mut mcp_stdin = mcp.stdin.take().expect("MCP stdin");
    let mut mcp_stdout = BufReader::new(mcp.stdout.take().expect("MCP stdout"));
    let request = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "plan_stdin_value_write",
            "arguments": {
                "projectPath": project.root(),
                "file": ".env.local",
                "key": "AUTH_SECRET",
                "trimFinalNewline": true
            }
        }
    });
    serde_json::to_writer(&mut mcp_stdin, &request).expect("write request");
    writeln!(&mut mcp_stdin).expect("request newline");
    mcp_stdin.flush().expect("flush request");
    let mut response_line = String::new();
    mcp_stdout
        .read_line(&mut response_line)
        .expect("read response");
    let response: Value = serde_json::from_str(&response_line).expect("response JSON");
    let projection = &response["result"]["structuredContent"];
    let plan_id = projection["planId"].as_str().expect("plan id");
    let broker_executable = projection["brokerExecutable"]
        .as_str()
        .expect("broker executable");
    assert_eq!(broker_executable, binary);
    assert!(!response_line.contains("fake_before"));

    let mut apply = Command::new(broker_executable)
        .args([
            "value",
            "apply-stdin",
            "--plan",
            plan_id,
            "--trim-final-newline",
        ])
        .env("KAVRANTA_APP_DATA_DIR", app_data.path())
        .env("KAVRANTA_REGISTRY_PATH", &registry_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .expect("spawn stdin apply");
    apply
        .stdin
        .take()
        .expect("apply stdin")
        .write_all(b"fake_cli_canary_931f\n")
        .expect("write fake producer value");
    let output = apply.wait_with_output().expect("wait for apply");
    assert!(output.status.success());
    let output_text = String::from_utf8(output.stdout).expect("UTF-8 output");
    assert!(output_text.contains(r#""resultCode":"OK""#));
    assert!(!output_text.contains("fake_cli_canary_931f"));
    assert_eq!(
        project.read(".env.local"),
        b"AUTH_SECRET=fake_cli_canary_931f\n"
    );

    drop(mcp_stdin);
    let _ = mcp.kill();
    let _ = mcp.wait();
}
