use std::fs;

use env_test_support::SyntheticProject;

use super::super::*;
use crate::guide::MAX_ATTACHMENT_BYTES;

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

#[test]
fn guide_attachments_are_bounded_by_name_format_and_size() {
    let project = SyntheticProject::new();
    project.write("app.env.local", "GEMINI_API_KEY=fake_secret\n");
    let service = ProjectService::open(project.root()).expect("service");
    service.initialize().expect("initialize");
    service
        .save_variable_guide("GEMINI_API_KEY", "# How to get it")
        .expect("save guide");

    let attachments = project.root().join(".env-manager/guides/attachments");
    fs::create_dir_all(&attachments).expect("attachments dir");
    let mut png = b"\x89PNG\r\n\x1a\n".to_vec();
    png.extend_from_slice(&[0u8; 64]);
    fs::write(attachments.join("console.PNG"), &png).expect("write png");

    let attachment = service
        .guide_attachment("GEMINI_API_KEY", "console.PNG")
        .expect("read attachment")
        .expect("attachment present");
    assert_eq!(attachment.mime_type, "image/png");
    assert!(!attachment.base64.is_empty());

    assert!(
        service
            .guide_attachment("GEMINI_API_KEY", "missing.png")
            .expect("missing")
            .is_none()
    );
    assert!(
        service
            .guide_attachment("UNKNOWN_KEY", "console.PNG")
            .expect("key without guide")
            .is_none()
    );
    assert!(
        service
            .guide_attachment("GEMINI_API_KEY", "../evil.png")
            .is_err()
    );
    assert!(
        service
            .guide_attachment("GEMINI_API_KEY", "a/b.png")
            .is_err()
    );

    fs::write(attachments.join("note.exe"), b"fake").expect("write exe");
    assert!(
        service
            .guide_attachment("GEMINI_API_KEY", "note.exe")
            .is_err()
    );

    let oversized = vec![0u8; MAX_ATTACHMENT_BYTES + 1];
    fs::write(attachments.join("big.png"), &oversized).expect("write big");
    assert!(
        service
            .guide_attachment("GEMINI_API_KEY", "big.png")
            .is_err()
    );
}
