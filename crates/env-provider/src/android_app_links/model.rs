use serde::{Deserialize, Serialize};

use super::AndroidAppLinksError;

const MAX_HOSTS: usize = 10;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AndroidAppLinksVerificationRequest {
    pub file: String,
    pub key: String,
    pub package_name: String,
    pub hosts: Vec<String>,
}

impl AndroidAppLinksVerificationRequest {
    pub(super) fn validate(&self) -> Result<(), AndroidAppLinksError> {
        if !is_fingerprint_variable_name(&self.key) {
            return Err(AndroidAppLinksError::new(
                "ANDROID_APP_LINKS_KEY_NOT_ELIGIBLE",
                "Android 인증서 지문임을 명확히 나타내는 변수만 검증할 수 있습니다.",
            ));
        }
        if !is_android_package_name(&self.package_name) {
            return Err(AndroidAppLinksError::new(
                "ANDROID_APP_LINKS_PACKAGE_INVALID",
                "Android 패키지 이름 형식이 올바르지 않습니다.",
            ));
        }
        if self.hosts.is_empty() || self.hosts.len() > MAX_HOSTS {
            return Err(AndroidAppLinksError::new(
                "ANDROID_APP_LINKS_HOSTS_INVALID",
                "한 번에 1개 이상 10개 이하의 호스트를 선택해주세요.",
            ));
        }
        let mut normalized = std::collections::BTreeSet::new();
        for host in &self.hosts {
            if !is_public_dns_name(host) || !normalized.insert(host.to_ascii_lowercase()) {
                return Err(AndroidAppLinksError::new(
                    "ANDROID_APP_LINKS_HOSTS_INVALID",
                    "중복되지 않은 공개 DNS 호스트 이름만 사용할 수 있습니다.",
                ));
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AndroidAppLinksHostState {
    Exact,
    LocalCovered,
    MissingOnRemote,
    Mismatch,
    NotFound,
    RedirectRejected,
    HttpError,
    InvalidContentType,
    InvalidDocument,
    PackageNotFound,
    RelationNotAuthorized,
    UnsafeAddress,
    ResponseTooLarge,
    RequestFailed,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AndroidAppLinksHostResult {
    pub host: String,
    pub state: AndroidAppLinksHostState,
    pub remote_fingerprint_count: Option<usize>,
    pub missing_on_remote_count: Option<usize>,
    pub additional_on_remote_count: Option<usize>,
    pub http_status: Option<u16>,
    pub result_code: &'static str,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AndroidAppLinksVerificationResult {
    pub package_name: String,
    pub local_fingerprint_count: usize,
    pub hosts: Vec<AndroidAppLinksHostResult>,
}

fn is_fingerprint_variable_name(key: &str) -> bool {
    let key = key.to_ascii_uppercase();
    key.contains("FINGERPRINT")
        && (key.contains("ANDROID")
            || key.contains("ASSETLINK")
            || key.contains("APP_LINK")
            || key.contains("SHA256_CERT"))
}

fn is_android_package_name(value: &str) -> bool {
    value.len() <= 255
        && value.split('.').count() >= 2
        && value.split('.').all(|segment| {
            let mut chars = segment.chars();
            chars
                .next()
                .is_some_and(|first| first.is_ascii_alphabetic())
                && chars.all(|character| character.is_ascii_alphanumeric() || character == '_')
        })
}

fn is_public_dns_name(value: &str) -> bool {
    value.len() <= 253
        && value.contains('.')
        && !value.ends_with('.')
        && value.parse::<std::net::IpAddr>().is_err()
        && value.split('.').all(|label| {
            !label.is_empty()
                && label.len() <= 63
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_rejects_generic_keys_and_non_host_inputs() {
        let request = AndroidAppLinksVerificationRequest {
            file: "synthetic.env".to_owned(),
            key: "API_SECRET".to_owned(),
            package_name: "com.example.app".to_owned(),
            hosts: vec!["example.test".to_owned()],
        };
        assert_eq!(
            request.validate().expect_err("generic key").code,
            "ANDROID_APP_LINKS_KEY_NOT_ELIGIBLE"
        );

        let request = AndroidAppLinksVerificationRequest {
            key: "ANDROID_CERT_FINGERPRINTS".to_owned(),
            hosts: vec!["https://example.test/path".to_owned()],
            ..request
        };
        assert_eq!(
            request.validate().expect_err("URL instead of host").code,
            "ANDROID_APP_LINKS_HOSTS_INVALID"
        );
    }

    #[test]
    fn request_rejects_ip_ports_single_labels_and_case_insensitive_duplicates() {
        for hosts in [
            vec!["127.0.0.1"],
            vec!["example.test:443"],
            vec!["localhost"],
            vec!["example.test", "EXAMPLE.TEST"],
        ] {
            let request = AndroidAppLinksVerificationRequest {
                file: "synthetic.env".to_owned(),
                key: "ANDROID_CERT_FINGERPRINTS".to_owned(),
                package_name: "com.example.app".to_owned(),
                hosts: hosts.into_iter().map(str::to_owned).collect(),
            };
            assert_eq!(
                request.validate().expect_err("invalid hosts").code,
                "ANDROID_APP_LINKS_HOSTS_INVALID"
            );
        }
    }
}
