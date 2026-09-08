use std::collections::BTreeSet;

use serde::Deserialize;

use super::fingerprint::{Fingerprint, parse_fingerprint};

const APP_LINK_RELATION: &str = "delegate_permission/common.handle_all_urls";

#[derive(Debug, PartialEq, Eq)]
pub(super) enum DocumentError {
    Invalid,
    PackageNotFound,
    RelationNotAuthorized,
}

#[derive(Deserialize)]
struct Statement {
    #[serde(default)]
    relation: Vec<String>,
    target: Option<Target>,
}

#[derive(Deserialize)]
struct Target {
    namespace: Option<String>,
    package_name: Option<String>,
    #[serde(default)]
    sha256_cert_fingerprints: Vec<String>,
}

pub(super) fn fingerprints_for_package(
    body: &[u8],
    package_name: &str,
) -> Result<BTreeSet<Fingerprint>, DocumentError> {
    let statements: Vec<Statement> =
        serde_json::from_slice(body).map_err(|_| DocumentError::Invalid)?;
    let mut package_seen = false;
    let mut relation_seen = false;
    let mut fingerprints = BTreeSet::new();

    for statement in statements {
        let Some(target) = statement.target else {
            continue;
        };
        if target.namespace.as_deref() != Some("android_app")
            || target.package_name.as_deref() != Some(package_name)
        {
            continue;
        }
        package_seen = true;
        if !statement
            .relation
            .iter()
            .any(|relation| relation == APP_LINK_RELATION)
        {
            continue;
        }
        relation_seen = true;
        for fingerprint in target.sha256_cert_fingerprints {
            fingerprints
                .insert(parse_fingerprint(&fingerprint).map_err(|_| DocumentError::Invalid)?);
        }
    }

    if !package_seen {
        Err(DocumentError::PackageNotFound)
    } else if !relation_seen {
        Err(DocumentError::RelationNotAuthorized)
    } else if fingerprints.is_empty() {
        Err(DocumentError::Invalid)
    } else {
        Ok(fingerprints)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FINGERPRINT: &str = "14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5";

    #[test]
    fn selects_only_the_authorized_android_package() {
        let body = serde_json::json!([
            {
                "relation": [APP_LINK_RELATION],
                "target": {
                    "namespace": "android_app",
                    "package_name": "com.other.app",
                    "sha256_cert_fingerprints": [FINGERPRINT]
                }
            },
            {
                "relation": [APP_LINK_RELATION],
                "target": {
                    "namespace": "android_app",
                    "package_name": "com.example.app",
                    "sha256_cert_fingerprints": [FINGERPRINT]
                }
            }
        ]);
        let result = fingerprints_for_package(
            serde_json::to_vec(&body).expect("json").as_slice(),
            "com.example.app",
        )
        .expect("package fingerprints");
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn distinguishes_missing_package_and_relation() {
        let unrelated = br#"[]"#;
        assert_eq!(
            fingerprints_for_package(unrelated, "com.example.app"),
            Err(DocumentError::PackageNotFound)
        );
        let body = serde_json::json!([{
            "relation": ["delegate_permission/common.get_login_creds"],
            "target": {
                "namespace": "android_app",
                "package_name": "com.example.app",
                "sha256_cert_fingerprints": [FINGERPRINT]
            }
        }]);
        assert_eq!(
            fingerprints_for_package(
                serde_json::to_vec(&body).expect("json").as_slice(),
                "com.example.app"
            ),
            Err(DocumentError::RelationNotAuthorized)
        );
    }
}
