use env_test_support::SyntheticProject;

use super::super::*;

#[test]
fn value_comparison_reports_equality_groups_without_values() {
    let project = SyntheticProject::new();
    let shared = "fake_COMPARE_SHARED_canary_41";
    let other = "fake_COMPARE_OTHER_canary_42";
    project.write(
        ".env.local",
        &format!("API_URL={shared}\nTOKEN={shared}\nEMPTY=\nONLY_LOCAL=fake_one\n"),
    );
    project.write(
        ".env.production",
        &format!("API_URL={other}\nTOKEN=\"{shared}\"\nEMPTY=fake_filled\n"),
    );
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");
    let manifest_before = project.read(MANIFEST_FILE_NAME);

    let comparison = service.compare_values().expect("compare");
    let serialized = serde_json::to_string(&comparison).expect("serialize");

    assert_eq!(comparison.files, vec![".env.local", ".env.production"]);
    let cells = |key: &str| {
        comparison
            .rows
            .iter()
            .find(|row| row.key == key)
            .map(|row| row.cells.clone())
            .expect("row")
    };
    assert_eq!(
        cells("API_URL"),
        vec![
            ValueComparisonCell::Present { group: 0 },
            ValueComparisonCell::Present { group: 1 }
        ]
    );
    assert_eq!(
        cells("TOKEN"),
        vec![
            ValueComparisonCell::Present { group: 0 },
            ValueComparisonCell::Present { group: 0 }
        ]
    );
    assert_eq!(
        cells("EMPTY"),
        vec![
            ValueComparisonCell::Empty,
            ValueComparisonCell::Present { group: 0 }
        ]
    );
    assert_eq!(
        cells("ONLY_LOCAL"),
        vec![
            ValueComparisonCell::Present { group: 0 },
            ValueComparisonCell::Missing
        ]
    );
    assert!(!serialized.contains(shared));
    assert!(!serialized.contains(other));
    assert!(!serialized.contains("fake_filled"));
    assert_eq!(project.read(MANIFEST_FILE_NAME), manifest_before);
}

#[test]
fn value_comparison_does_not_compare_duplicate_occurrences() {
    let project = SyntheticProject::new();
    project.write(".env.local", "KEY=fake_first\nKEY=fake_second\n");
    project.write(".env.test", "KEY=fake_first\n");
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");

    let comparison = service.compare_values().expect("compare");

    assert_eq!(
        comparison.rows[0].cells,
        vec![
            ValueComparisonCell::Duplicate,
            ValueComparisonCell::Present { group: 0 }
        ]
    );
}
