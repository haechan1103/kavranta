use std::collections::BTreeMap;

use super::*;
use crate::android_app_links::transport::FetchResponse;
use env_core::{CodexAccess, ProjectService};

const LOCAL_ONE: &str = "FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE:FA:CE";
const LOCAL_TWO: &str = "BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD:BA:AD";
const REMOTE_EXTRA: &str = "DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD:DE:AD";

struct FakeFetcher {
    responses: BTreeMap<String, Result<FetchResponse, FetchError>>,
}

impl AssetLinksFetcher for FakeFetcher {
    fn fetch(&self, host: &str) -> Result<FetchResponse, FetchError> {
        self.responses
            .get(host)
            .cloned()
            .ok_or(FetchError::RequestFailed)
            .flatten()
    }
}

fn fixture() -> (tempfile::TempDir, ProjectService, String) {
    let project = tempfile::tempdir().expect("synthetic project");
    let file = ["synthetic", ".", "env", ".local"].concat();
    std::fs::write(
        project.path().join(&file),
        format!("ANDROID_CERT_FINGERPRINTS={LOCAL_ONE},{LOCAL_TWO}\n"),
    )
    .expect("synthetic public fingerprint fixture");
    let service = ProjectService::open(project.path()).expect("service");
    service.initialize().expect("initialize");
    (project, service, file)
}

fn document(fingerprints: &[&str]) -> Vec<u8> {
    serde_json::to_vec(&serde_json::json!([{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
            "namespace": "android_app",
            "package_name": "com.example.app",
            "sha256_cert_fingerprints": fingerprints
        }
    }]))
    .expect("document")
}

#[test]
fn protected_fingerprints_are_compared_without_becoming_readable() {
    let (_project, service, file) = fixture();
    let fetcher = FakeFetcher {
        responses: BTreeMap::from([
            (
                "www.example.test".to_owned(),
                Ok(FetchResponse {
                    status: 200,
                    content_type_is_json: true,
                    body: document(&[LOCAL_ONE, LOCAL_TWO]),
                }),
            ),
            (
                "example.test".to_owned(),
                Ok(FetchResponse {
                    status: 404,
                    content_type_is_json: false,
                    body: Vec::new(),
                }),
            ),
        ]),
    };
    let result = verify_with_fetcher(
        &service,
        AndroidAppLinksVerificationRequest {
            file,
            key: "ANDROID_CERT_FINGERPRINTS".to_owned(),
            package_name: "com.example.app".to_owned(),
            hosts: vec!["www.example.test".to_owned(), "example.test".to_owned()],
        },
        &fetcher,
    )
    .expect("verification");

    assert_eq!(result.local_fingerprint_count, 2);
    assert_eq!(result.hosts[0].state, AndroidAppLinksHostState::Exact);
    assert_eq!(result.hosts[1].state, AndroidAppLinksHostState::NotFound);
    assert_eq!(
        service
            .codex_access("ANDROID_CERT_FINGERPRINTS")
            .expect("policy"),
        CodexAccess::Unclassified
    );
    let serialized = serde_json::to_string(&result).expect("result json");
    assert!(!serialized.contains(LOCAL_ONE));
    assert!(!serialized.contains(LOCAL_TWO));
}

#[test]
fn comparison_reports_counts_without_fingerprint_material() {
    let (_project, service, file) = fixture();
    let fetcher = FakeFetcher {
        responses: BTreeMap::from([(
            "www.example.test".to_owned(),
            Ok(FetchResponse {
                status: 200,
                content_type_is_json: true,
                body: document(&[LOCAL_ONE, REMOTE_EXTRA]),
            }),
        )]),
    };
    let result = verify_with_fetcher(
        &service,
        AndroidAppLinksVerificationRequest {
            file,
            key: "ANDROID_CERT_FINGERPRINTS".to_owned(),
            package_name: "com.example.app".to_owned(),
            hosts: vec!["www.example.test".to_owned()],
        },
        &fetcher,
    )
    .expect("verification");

    assert_eq!(result.hosts[0].state, AndroidAppLinksHostState::Mismatch);
    assert_eq!(result.hosts[0].missing_on_remote_count, Some(1));
    assert_eq!(result.hosts[0].additional_on_remote_count, Some(1));
    let serialized = serde_json::to_string(&result).expect("result json");
    assert!(!serialized.contains(LOCAL_ONE));
    assert!(!serialized.contains(LOCAL_TWO));
    assert!(!serialized.contains(REMOTE_EXTRA));
}

#[test]
fn remote_failures_remain_per_host_redacted_states() {
    let (_project, service, file) = fixture();
    let fetcher = FakeFetcher {
        responses: BTreeMap::from([
            (
                "redirect.example.test".to_owned(),
                Ok(FetchResponse {
                    status: 302,
                    content_type_is_json: false,
                    body: Vec::new(),
                }),
            ),
            (
                "large.example.test".to_owned(),
                Err(FetchError::ResponseTooLarge),
            ),
            (
                "wrong.example.test".to_owned(),
                Ok(FetchResponse {
                    status: 200,
                    content_type_is_json: true,
                    body: document(&["DE:FI:NI:TE:LY:IN:VA:LI:D"]),
                }),
            ),
        ]),
    };
    let result = verify_with_fetcher(
        &service,
        AndroidAppLinksVerificationRequest {
            file,
            key: "ANDROID_CERT_FINGERPRINTS".to_owned(),
            package_name: "com.example.app".to_owned(),
            hosts: vec![
                "redirect.example.test".to_owned(),
                "large.example.test".to_owned(),
                "wrong.example.test".to_owned(),
            ],
        },
        &fetcher,
    )
    .expect("redacted failure states");

    assert_eq!(
        result.hosts[0].state,
        AndroidAppLinksHostState::RedirectRejected
    );
    assert_eq!(
        result.hosts[1].state,
        AndroidAppLinksHostState::ResponseTooLarge
    );
    assert_eq!(
        result.hosts[2].state,
        AndroidAppLinksHostState::InvalidDocument
    );
    let serialized = serde_json::to_string(&result).expect("result json");
    assert!(!serialized.contains(LOCAL_ONE));
    assert!(!serialized.contains(LOCAL_TWO));
    assert!(!serialized.contains("DE:FI"));
}
