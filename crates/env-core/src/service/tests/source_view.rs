use env_test_support::SyntheticProject;

use super::super::*;

#[test]
fn redacted_source_keeps_structure_and_withholds_every_value() {
    let project = SyntheticProject::new();
    let canary = "fake_SOURCE_VIEW_canary_77";
    let commented = "fake_COMMENTED_canary_78";
    project.write(
        ".env.local",
        &format!(
            "# Local settings\n\nAPI_KEY={canary}\nEMPTY=\n# OLD_KEY={commented}\n#   export LEGACY = {commented}\n"
        ),
    );
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");

    let lines = service.redacted_source(".env.local").expect("source");
    let serialized = serde_json::to_string(&lines).expect("serialize");

    assert!(!serialized.contains(canary));
    assert!(!serialized.contains(commented));
    let contents = lines
        .iter()
        .map(|line| (line.line, line.content.clone()))
        .collect::<Vec<_>>();
    assert_eq!(
        contents,
        vec![
            (
                1,
                RedactedSourceContent::Comment {
                    text: " Local settings".to_owned()
                }
            ),
            (2, RedactedSourceContent::Blank),
            (
                3,
                RedactedSourceContent::Assignment {
                    key: "API_KEY".to_owned(),
                    value_state: RedactedValueState::Present
                }
            ),
            (
                4,
                RedactedSourceContent::Assignment {
                    key: "EMPTY".to_owned(),
                    value_state: RedactedValueState::Empty
                }
            ),
            (
                5,
                RedactedSourceContent::WithheldComment {
                    key: Some("OLD_KEY".to_owned())
                }
            ),
            (
                6,
                RedactedSourceContent::WithheldComment {
                    key: Some("LEGACY".to_owned())
                }
            ),
        ]
    );
}

#[test]
fn redacted_source_withholds_secret_shaped_comments_and_unparsed_lines() {
    let project = SyntheticProject::new();
    let token = format!("ghp_{}", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8");
    project.write(
        ".env.local",
        &format!("# token {token}\nnot an assignment fake_unparsed_canary\nKEY=fake_value\n"),
    );
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");

    let lines = service.redacted_source(".env.local").expect("source");
    let serialized = serde_json::to_string(&lines).expect("serialize");

    assert!(!serialized.contains(&token));
    assert!(!serialized.contains("fake_unparsed_canary"));
    assert_eq!(
        lines[0].content,
        RedactedSourceContent::WithheldComment { key: None }
    );
    assert_eq!(lines[1].content, RedactedSourceContent::Unparsed);
}

#[test]
fn redacted_source_rejects_files_outside_the_managed_set() {
    let project = SyntheticProject::new();
    project.write(".env.local", "KEY=fake_value\n");
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");

    assert!(service.redacted_source("../outside.env").is_err());
    assert!(service.redacted_source("missing.env").is_err());
}
