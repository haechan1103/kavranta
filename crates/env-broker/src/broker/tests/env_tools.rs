use super::*;

#[test]
fn unknown_mcp_client_names_stay_unattributed() {
    assert_eq!(normalize_agent_host("Codex Desktop"), Some("codex"));
    assert_eq!(normalize_agent_host("claude-code"), Some("claude-code"));
    assert_eq!(
        normalize_agent_host("GitHub Copilot"),
        Some("github-copilot")
    );
    assert_eq!(normalize_agent_host("Cursor Agent"), Some("cursor"));
    assert_eq!(normalize_agent_host("custom-agent"), None);
}

#[test]
fn inspect_is_redacted_and_canary_free() {
    let (project, _) = registered_project();
    let output = Broker::with_registered_roots(vec![project.root().to_path_buf()])
        .call_tool(
            "inspect_project",
            json!({ "projectPath": project.root().to_string_lossy() }),
        )
        .expect("inspect")
        .to_string();
    assert!(!output.contains(CANARY));
    assert!(output.contains("GPT_API_KEY"));
    assert!(output.contains("\"valueState\":\"present\""));
}

#[test]
fn protected_read_is_denied_without_leaking_canary() {
    let (project, _) = registered_project();
    let error = Broker::with_registered_roots(vec![project.root().to_path_buf()])
        .call_tool(
            "read_allowed_value",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "key": "GPT_API_KEY"
            }),
        )
        .expect_err("protected read must fail");
    assert_eq!(error.code(), EnvErrorCode::CodexAccessBlocked);
    assert!(!error.to_string().contains(CANARY));
}

#[test]
fn finds_and_copies_a_protected_value_across_registered_projects_opaquely() {
    let source = SyntheticProject::new();
    let target = SyntheticProject::new();
    let cross_project_canary = "fake_CROSS_PROJECT_BROKER_CANARY_92";
    source.write(
        ".env.local",
        &format!("GEMINI_API_KEY={cross_project_canary}\n"),
    );
    target.write(".env.local", "GEMINI_API_KEY=\n");
    let source_service = ProjectService::open(source.root()).expect("source service");
    let target_service = ProjectService::open(target.root()).expect("target service");
    source_service.initialize().expect("source initialize");
    target_service.initialize().expect("target initialize");
    let broker = Broker::with_registered_roots(vec![
        source.root().to_path_buf(),
        target.root().to_path_buf(),
    ]);

    let candidates = broker
        .call_tool(
            "find_reusable_variable_sources",
            json!({
                "projectPath": target.root().to_string_lossy(),
                "key": "GEMINI_API_KEY"
            }),
        )
        .expect("candidate search");
    let candidate_output = candidates.to_string();
    assert!(candidate_output.contains(source_service.project_id()));
    assert!(candidate_output.contains(".env.local"));
    assert!(!candidate_output.contains(cross_project_canary));

    let plan = broker
        .call_tool(
            "plan_copy_variable_from_project",
            json!({
                "projectPath": target.root().to_string_lossy(),
                "sourceProjectId": source_service.project_id(),
                "sourceFile": ".env.local",
                "targetFile": ".env.local",
                "key": "GEMINI_API_KEY"
            }),
        )
        .expect("opaque copy plan");
    assert!(!plan.to_string().contains(cross_project_canary));
    let plan_id = plan.get("planId").and_then(Value::as_str).expect("plan id");
    let result = broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("opaque copy apply");

    assert!(!result.to_string().contains(cross_project_canary));
    assert_eq!(
        target.read(".env.local"),
        format!("GEMINI_API_KEY={cross_project_canary}\n").as_bytes()
    );
    assert_eq!(
        source_service
            .codex_access("GEMINI_API_KEY")
            .expect("source policy"),
        CodexAccess::Protected
    );
    assert_eq!(
        target_service
            .codex_access("GEMINI_API_KEY")
            .expect("target policy"),
        CodexAccess::Protected
    );
}

#[test]
fn resolves_registered_project_aliases_and_searches_sources_without_values() {
    let mobile = SyntheticProject::new();
    let api = SyntheticProject::new();
    let missing_manifest = SyntheticProject::new();
    let mobile_canary = "fake_OPENROUTER_MOBILE_CANARY_31";
    let api_canary = "fake_OPENROUTER_API_CANARY_47";
    mobile.write(
        ".env.local",
        &format!("OPENROUTER_API_KEY={mobile_canary}\nOPENROUTER_EMPTY=\n"),
    );
    api.write(
        ".env.production",
        &format!("OPENROUTER_API_KEY={api_canary}\n"),
    );
    missing_manifest.write(
        ".env.local",
        "OPENROUTER_API_KEY=fake_UNINITIALIZED_CANARY_63\n",
    );
    let mobile_service = ProjectService::open(mobile.root()).expect("mobile service");
    let api_service = ProjectService::open(api.root()).expect("api service");
    mobile_service.initialize().expect("mobile initialize");
    api_service.initialize().expect("api initialize");
    let mobile_manifest_before = mobile.read(env_core::MANIFEST_FILE_NAME);
    let app_data = tempfile::tempdir().expect("app data");
    let stale_root = app_data.path().join("removed-project");
    env_registry::write(
        &app_data.path().join("projects.json"),
        &env_registry::RegistryData {
            projects: vec![
                ProjectRegistration {
                    id: mobile_service.project_id().to_owned(),
                    name: "쏙핀 Mobile".to_owned(),
                    display_path: mobile.root().to_string_lossy().into_owned(),
                    root: mobile.root().to_path_buf(),
                    file_labels: Default::default(),
                },
                ProjectRegistration {
                    id: api_service.project_id().to_owned(),
                    name: "쏙핀 API".to_owned(),
                    display_path: api.root().to_string_lossy().into_owned(),
                    root: api.root().to_path_buf(),
                    file_labels: Default::default(),
                },
                ProjectRegistration {
                    id: "missing-manifest".to_owned(),
                    name: "쏙핀 Draft".to_owned(),
                    display_path: missing_manifest.root().to_string_lossy().into_owned(),
                    root: missing_manifest.root().to_path_buf(),
                    file_labels: Default::default(),
                },
                ProjectRegistration {
                    id: "stale-project".to_owned(),
                    name: "쏙핀 Old".to_owned(),
                    display_path: stale_root.to_string_lossy().into_owned(),
                    root: stale_root,
                    file_labels: Default::default(),
                },
            ],
            ..env_registry::RegistryData::default()
        },
    )
    .expect("registry");
    let broker = Broker::with_workspace_and_app_data(
        mobile.root().to_path_buf(),
        app_data.path().to_path_buf(),
    );

    let projects = broker
        .call_tool(
            "find_registered_projects",
            json!({ "query": "쏙핀", "limit": 10 }),
        )
        .expect("project lookup");
    assert_eq!(
        projects
            .get("candidates")
            .and_then(Value::as_array)
            .map(Vec::len),
        Some(2)
    );
    assert_eq!(projects.get("unavailableCount"), Some(&json!(2)));
    assert!(projects.to_string().contains("projectPath"));
    assert!(!projects.to_string().contains(mobile_canary));
    assert!(!projects.to_string().contains(api_canary));

    let scoped = broker
        .call_tool(
            "search_registered_variable_sources",
            json!({
                "query": "open-route",
                "projectId": mobile_service.project_id(),
                "includeEmpty": false
            }),
        )
        .expect("scoped variable search");
    let scoped_candidates = scoped
        .get("candidates")
        .and_then(Value::as_array)
        .expect("scoped candidates");
    assert_eq!(scoped_candidates.len(), 1);
    assert_eq!(
        scoped_candidates[0].get("key"),
        Some(&json!("OPENROUTER_API_KEY"))
    );
    assert_eq!(
        scoped_candidates[0].get("codexAccess"),
        Some(&json!("protected"))
    );
    assert_eq!(scoped.get("searchedProjectCount"), Some(&json!(1)));

    let global = broker
        .call_tool(
            "search_registered_variable_sources",
            json!({ "query": "OPENROUTE", "limit": 1 }),
        )
        .expect("global variable search");
    assert_eq!(global.get("truncated"), Some(&json!(true)));
    assert_eq!(global.get("skippedProjectCount"), Some(&json!(2)));
    assert_eq!(
        global
            .get("candidates")
            .and_then(Value::as_array)
            .map(Vec::len),
        Some(1)
    );
    let serialized = global.to_string();
    assert!(!serialized.contains(mobile_canary));
    assert!(!serialized.contains(api_canary));
    assert_eq!(
        mobile.read(env_core::MANIFEST_FILE_NAME),
        mobile_manifest_before
    );
    assert!(
        !missing_manifest
            .root()
            .join(env_core::MANIFEST_FILE_NAME)
            .exists()
    );
}

#[test]
fn registered_search_rejects_unbounded_or_trivial_requests() {
    let broker = Broker::with_registered_roots(Vec::new());
    assert!(
        broker
            .call_tool(
                "find_registered_projects",
                json!({ "query": "project", "limit": 26 })
            )
            .is_err()
    );
    assert!(
        broker
            .call_tool(
                "search_registered_variable_sources",
                json!({ "query": "_" })
            )
            .is_err()
    );
    let missing_scope = broker
        .call_tool(
            "search_registered_variable_sources",
            json!({ "query": "OPENROUTE", "projectId": "not-registered" }),
        )
        .expect_err("missing scope must fail");
    assert_eq!(missing_scope.code(), EnvErrorCode::UnregisteredProject);
    assert!(
        broker
            .call_tool(
                "search_registered_variable_sources",
                json!({ "query": "A".repeat(81) })
            )
            .is_err()
    );
}

#[test]
fn plan_output_never_contains_replacement_value() {
    let (project, _) = registered_project();
    let replacement = "fake_REPLACEMENT_canary_82";
    let output = Broker::with_registered_roots(vec![project.root().to_path_buf()])
        .call_tool(
            "plan_set_allowed_value",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "key": "PORT",
                "newValue": replacement
            }),
        )
        .expect("plan")
        .to_string();
    assert!(!output.contains(replacement));
}

#[test]
fn creates_a_new_env_file_and_adds_empty_variables_without_approval() {
    let project = SyntheticProject::new();
    fs::create_dir_all(project.root().join("apps/mobile")).expect("fixture directory");
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");
    let broker = Broker::with_registered_roots(vec![project.root().to_path_buf()]);

    let file_plan = broker
        .call_tool(
            "plan_create_env_file",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": "apps/mobile/.env"
            }),
        )
        .expect("file plan");
    let plan_id = file_plan
        .get("planId")
        .and_then(Value::as_str)
        .expect("plan id");
    broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("file apply");

    let wrangler_plan = broker
        .call_tool(
            "plan_create_env_file",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": "apps/mobile/.dev.vars.staging"
            }),
        )
        .expect("Wrangler file plan");
    let wrangler_plan_id = wrangler_plan
        .get("planId")
        .and_then(Value::as_str)
        .expect("Wrangler plan id");
    broker
        .call_tool("apply_plan", json!({ "planId": wrangler_plan_id }))
        .expect("Wrangler file apply");
    assert_eq!(project.read("apps/mobile/.dev.vars.staging"), b"");

    for key in [
        "EXPO_PUBLIC_API_BASE_URL",
        "EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ] {
        let variable_plan = broker
            .call_tool(
                "plan_add_variable",
                json!({
                    "projectPath": project.root().to_string_lossy(),
                    "file": "apps/mobile/.env",
                    "key": key,
                    "group": "Mobile"
                }),
            )
            .expect("variable plan");
        let plan_id = variable_plan
            .get("planId")
            .and_then(Value::as_str)
            .expect("plan id");
        broker
            .call_tool("apply_plan", json!({ "planId": plan_id }))
            .expect("variable apply");
    }

    let output = String::from_utf8(project.read("apps/mobile/.env")).expect("utf8");
    assert_eq!(output.matches("# @group Mobile").count(), 1);
    for key in [
        "EXPO_PUBLIC_API_BASE_URL",
        "EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ] {
        assert!(output.contains(&format!("{key}=\n")));
    }
}

#[test]
fn request_authorized_plan_updates_only_an_allowed_value() {
    let (project, _) = registered_project();
    let broker = Broker::with_registered_roots(vec![project.root().to_path_buf()]);
    let plan = broker
        .call_tool(
            "plan_set_allowed_value",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "key": "PORT",
                "newValue": "fake_4200"
            }),
        )
        .expect("plan");
    let plan_id = plan.get("planId").and_then(Value::as_str).expect("plan id");
    broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("apply");
    assert_eq!(
        project.read(".env.local"),
        format!("GPT_API_KEY={CANARY}\nPORT=fake_4200\n").as_bytes()
    );
}

#[test]
fn apply_plan_accepts_only_the_plan_id() {
    let (project, _) = registered_project();
    let broker = Broker::with_registered_roots(vec![project.root().to_path_buf()]);
    let plan = broker
        .call_tool(
            "plan_set_allowed_value",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "key": "PORT",
                "newValue": "fake_4300"
            }),
        )
        .expect("plan");
    let plan_id = plan.get("planId").and_then(Value::as_str).expect("plan id");

    let obsolete_argument = broker
        .call_tool(
            "apply_plan",
            json!({ "planId": plan_id, "confirmed": true }),
        )
        .expect_err("obsolete confirmation argument must be rejected");
    assert_eq!(obsolete_argument.code(), EnvErrorCode::InvalidRequest);

    broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("request-authorized apply");
    assert_eq!(
        project.read(".env.local"),
        format!("GPT_API_KEY={CANARY}\nPORT=fake_4300\n").as_bytes()
    );
}

#[test]
fn explicitly_requested_access_change_needs_no_second_confirmation() {
    let (project, service) = registered_project();
    assert_eq!(
        service.codex_access("GPT_API_KEY").expect("initial policy"),
        CodexAccess::Protected
    );
    let broker = Broker::with_registered_roots(vec![project.root().to_path_buf()]);
    let plan = broker
        .call_tool(
            "plan_classification",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "key": "GPT_API_KEY",
                "access": "read-write"
            }),
        )
        .expect("classification plan");
    let plan_id = plan.get("planId").and_then(Value::as_str).expect("plan id");

    broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("classification apply");

    let reopened = ProjectService::open(project.root()).expect("service");
    assert_eq!(
        reopened
            .codex_access("GPT_API_KEY")
            .expect("updated policy"),
        CodexAccess::ReadWrite
    );
}

#[test]
fn structural_group_plans_create_move_and_rename_without_value_output() {
    let (project, _) = registered_project();
    let broker = Broker::with_registered_roots(vec![project.root().to_path_buf()]);

    for (tool_name, arguments) in [
        (
            "plan_create_group",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "name": "Database"
            }),
        ),
        (
            "plan_move_variable",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "key": "PORT",
                "targetGroup": "Database"
            }),
        ),
        (
            "plan_rename_group",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "currentName": "Database",
                "newName": "Runtime"
            }),
        ),
    ] {
        let plan = broker.call_tool(tool_name, arguments).expect("plan");
        assert!(!plan.to_string().contains(CANARY));
        let plan_id = plan.get("planId").and_then(Value::as_str).expect("plan id");
        broker
            .call_tool("apply_plan", json!({ "planId": plan_id }))
            .expect("apply");
    }

    let output = String::from_utf8(project.read(".env.local")).expect("utf8");
    assert!(output.contains("# @group Runtime"));
    assert!(output.find("# @group Runtime").expect("group") < output.find("PORT=").expect("key"));
    assert!(output.contains(&format!("GPT_API_KEY={CANARY}")));
}

#[test]
fn codex_adds_only_an_empty_variable_and_can_update_its_description() {
    let (project, _) = registered_project();
    let broker = Broker::with_registered_roots(vec![project.root().to_path_buf()]);
    let plan = broker
        .call_tool(
            "plan_add_variable",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "key": "DATABASE_URL",
                "group": "Database",
                "description": ["fake database description"]
            }),
        )
        .expect("add plan");
    let plan_id = plan.get("planId").and_then(Value::as_str).expect("plan id");
    broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("add apply");

    let added = String::from_utf8(project.read(".env.local")).expect("utf8");
    assert!(added.contains("DATABASE_URL=\n"));
    assert!(added.contains("# @group Database"));

    let description_plan = broker
        .call_tool(
            "plan_update_description",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "key": "DATABASE_URL",
                "lines": ["fake updated description"]
            }),
        )
        .expect("description plan");
    let plan_id = description_plan
        .get("planId")
        .and_then(Value::as_str)
        .expect("plan id");
    broker
        .call_tool("apply_plan", json!({ "planId": plan_id }))
        .expect("description apply");

    let output = String::from_utf8(project.read(".env.local")).expect("utf8");
    assert!(output.contains("# fake updated description\nDATABASE_URL=\n"));
    assert!(output.contains(&format!("GPT_API_KEY={CANARY}")));
}

#[test]
fn add_variable_tool_rejects_a_value_argument() {
    let (project, _) = registered_project();
    let error = Broker::with_registered_roots(vec![project.root().to_path_buf()])
        .call_tool(
            "plan_add_variable",
            json!({
                "projectPath": project.root().to_string_lossy(),
                "file": ".env.local",
                "key": "DATABASE_URL",
                "group": "Database",
                "value": "fake_must_not_be_accepted"
            }),
        )
        .expect_err("value argument must be rejected");
    assert_eq!(error.code(), EnvErrorCode::InvalidRequest);
    assert!(
        !project
            .read(".env.local")
            .windows(25)
            .any(|bytes| bytes == b"fake_must_not_be_accepted")
    );
}
