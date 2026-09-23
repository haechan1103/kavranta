use env_test_support::SyntheticProject;

use super::super::*;

#[test]
fn variable_guides_are_value_free_and_reflected_in_the_projection() {
    let project = SyntheticProject::new();
    project.write(".env.local", "GEMINI_API_KEY=fake_secret\n");
    let service = ProjectService::open(project.root()).expect("service");
    let projection = service.initialize().expect("initialize");
    assert!(!projection.files[0].groups[0].variables[0].has_guide);

    service
        .save_variable_guide("GEMINI_API_KEY", "# How to get it\n\n1. Open the console")
        .expect("save guide");

    let guide = service
        .variable_guide("GEMINI_API_KEY")
        .expect("read guide")
        .expect("guide present");
    assert!(guide.contains("How to get it"));

    let manifest = ManifestStore::for_root(project.root())
        .load()
        .expect("manifest");
    assert_eq!(
        manifest.guides.get("GEMINI_API_KEY").map(String::as_str),
        Some(".env-manager/guides/GEMINI_API_KEY.md")
    );

    let projection = service.scan().expect("rescan");
    assert!(projection.files[0].groups[0].variables[0].has_guide);

    service
        .remove_variable_guide("GEMINI_API_KEY")
        .expect("remove guide");
    assert!(
        service
            .variable_guide("GEMINI_API_KEY")
            .expect("read")
            .is_none()
    );
    assert!(
        !project
            .root()
            .join(".env-manager/guides/GEMINI_API_KEY.md")
            .exists()
    );
}
