use env_test_support::SyntheticProject;

use super::super::*;

#[test]
fn redacted_search_matches_partial_names_without_mutating_or_leaking_values() {
    let project = SyntheticProject::new();
    let canary = "fake_SEARCH_CANARY_never_returned_58";
    project.write(
        ".env.local",
        &format!("OPENROUTER_API_KEY={canary}\nOPENROUTER_EMPTY=\nPORT=fake_3000\n"),
    );
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");
    let manifest_before = project.read(MANIFEST_FILE_NAME);

    let matches = service
        .search_redacted_variables("open-route", false)
        .expect("redacted search");
    let serialized = serde_json::to_string(&matches).expect("serialize");

    assert_eq!(matches.len(), 1);
    assert_eq!(matches[0].key, "OPENROUTER_API_KEY");
    assert_eq!(matches[0].codex_access, CodexAccess::Protected);
    assert_eq!(
        matches[0].occurrences[0].value_state,
        RedactedValueState::Present
    );
    assert!(!serialized.contains(canary));
    assert_eq!(project.read(MANIFEST_FILE_NAME), manifest_before);

    let including_empty = service
        .search_redacted_variables("openroute", true)
        .expect("search including empty");
    assert_eq!(including_empty.len(), 2);
    assert_eq!(including_empty[1].key, "OPENROUTER_EMPTY");
    assert_eq!(
        including_empty[1].occurrences[0].value_state,
        RedactedValueState::Empty
    );
}

#[test]
fn redacted_search_skips_ambiguous_duplicate_occurrences() {
    let project = SyntheticProject::new();
    project.write(
        ".env.local",
        "OPENROUTER_API_KEY=fake_first\nOPENROUTER_API_KEY=fake_second\n",
    );
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");

    assert!(
        service
            .search_redacted_variables("OPENROUTE", true)
            .expect("redacted search")
            .is_empty()
    );
}

#[test]
fn redacted_search_rejects_trivial_queries() {
    let project = SyntheticProject::new();
    project.write(".env.local", "PORT=fake_3000\n");
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");

    assert!(service.search_redacted_variables("_", false).is_err());
    assert!(service.search_redacted_variables("P", false).is_err());
    assert!(
        service
            .search_redacted_variables(&"A".repeat(81), false)
            .is_err()
    );
}
