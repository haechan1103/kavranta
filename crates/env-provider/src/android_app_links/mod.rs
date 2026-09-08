mod document;
mod fingerprint;
mod model;
mod transport;

use std::collections::BTreeSet;

use env_core::{EnvError, ProjectService};

pub use model::{
    AndroidAppLinksHostResult, AndroidAppLinksHostState, AndroidAppLinksVerificationRequest,
    AndroidAppLinksVerificationResult,
};

use document::{DocumentError, fingerprints_for_package};
use fingerprint::{Fingerprint, parse_fingerprint_list};
use transport::{AssetLinksFetcher, FetchError, HttpsAssetLinksFetcher};

#[derive(Debug)]
pub struct AndroidAppLinksError {
    pub code: &'static str,
    pub message: &'static str,
}

impl AndroidAppLinksError {
    fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
}

impl From<EnvError> for AndroidAppLinksError {
    fn from(error: EnvError) -> Self {
        let code = match error.code().as_str() {
            "PATH_OUTSIDE_REGISTERED_PROJECT" => "PATH_OUTSIDE_REGISTERED_PROJECT",
            "PARSE_AMBIGUOUS_DUPLICATE_KEY" => "PARSE_AMBIGUOUS_DUPLICATE_KEY",
            _ => "ANDROID_APP_LINKS_SOURCE_UNAVAILABLE",
        };
        let message = match code {
            "PATH_OUTSIDE_REGISTERED_PROJECT" => "등록된 프로젝트 밖의 파일은 검증할 수 없습니다.",
            "PARSE_AMBIGUOUS_DUPLICATE_KEY" => {
                "중복된 변수는 Android App Links 검증에 사용할 수 없습니다."
            }
            _ => "관리 중인 인증서 지문 변수를 준비하지 못했습니다.",
        };
        Self { code, message }
    }
}

pub fn verify(
    service: &ProjectService,
    request: AndroidAppLinksVerificationRequest,
) -> Result<AndroidAppLinksVerificationResult, AndroidAppLinksError> {
    verify_with_fetcher(service, request, &HttpsAssetLinksFetcher)
}

fn verify_with_fetcher<F: AssetLinksFetcher>(
    service: &ProjectService,
    request: AndroidAppLinksVerificationRequest,
    fetcher: &F,
) -> Result<AndroidAppLinksVerificationResult, AndroidAppLinksError> {
    request.validate()?;
    let values = service.provider_values(&request.file, std::slice::from_ref(&request.key))?;
    let value = values.first().ok_or_else(|| {
        AndroidAppLinksError::new(
            "ANDROID_APP_LINKS_SOURCE_UNAVAILABLE",
            "관리 중인 인증서 지문 변수를 준비하지 못했습니다.",
        )
    })?;
    let local = parse_fingerprint_list(value.value()).map_err(|_| {
        AndroidAppLinksError::new(
            "ANDROID_APP_LINKS_SOURCE_INVALID",
            "선택한 변수는 SHA-256 인증서 지문 목록 형식이 아닙니다.",
        )
    })?;

    let hosts = request
        .hosts
        .iter()
        .map(|host| verify_host(fetcher, host, &request.package_name, &local))
        .collect();

    Ok(AndroidAppLinksVerificationResult {
        package_name: request.package_name,
        local_fingerprint_count: local.len(),
        hosts,
    })
}

fn verify_host<F: AssetLinksFetcher>(
    fetcher: &F,
    host: &str,
    package_name: &str,
    local: &BTreeSet<Fingerprint>,
) -> AndroidAppLinksHostResult {
    let response = match fetcher.fetch(host) {
        Ok(response) => response,
        Err(error) => return AndroidAppLinksHostResult::from_fetch_error(host, error),
    };
    if (300..400).contains(&response.status) {
        return AndroidAppLinksHostResult::failure(
            host,
            AndroidAppLinksHostState::RedirectRejected,
            "ANDROID_APP_LINKS_REDIRECT_REJECTED",
            Some(response.status),
        );
    }
    if response.status == 404 {
        return AndroidAppLinksHostResult::failure(
            host,
            AndroidAppLinksHostState::NotFound,
            "ANDROID_APP_LINKS_NOT_FOUND",
            Some(response.status),
        );
    }
    if response.status != 200 {
        return AndroidAppLinksHostResult::failure(
            host,
            AndroidAppLinksHostState::HttpError,
            "ANDROID_APP_LINKS_HTTP_ERROR",
            Some(response.status),
        );
    }
    if !response.content_type_is_json {
        return AndroidAppLinksHostResult::failure(
            host,
            AndroidAppLinksHostState::InvalidContentType,
            "ANDROID_APP_LINKS_CONTENT_TYPE_INVALID",
            Some(response.status),
        );
    }

    let remote = match fingerprints_for_package(&response.body, package_name) {
        Ok(remote) => remote,
        Err(DocumentError::PackageNotFound) => {
            return AndroidAppLinksHostResult::failure(
                host,
                AndroidAppLinksHostState::PackageNotFound,
                "ANDROID_APP_LINKS_PACKAGE_NOT_FOUND",
                Some(response.status),
            );
        }
        Err(DocumentError::RelationNotAuthorized) => {
            return AndroidAppLinksHostResult::failure(
                host,
                AndroidAppLinksHostState::RelationNotAuthorized,
                "ANDROID_APP_LINKS_RELATION_NOT_AUTHORIZED",
                Some(response.status),
            );
        }
        Err(DocumentError::Invalid) => {
            return AndroidAppLinksHostResult::failure(
                host,
                AndroidAppLinksHostState::InvalidDocument,
                "ANDROID_APP_LINKS_DOCUMENT_INVALID",
                Some(response.status),
            );
        }
    };

    AndroidAppLinksHostResult::comparison(host, response.status, local, &remote)
}

impl AndroidAppLinksHostResult {
    fn from_fetch_error(host: &str, error: FetchError) -> Self {
        let (state, code) = match error {
            FetchError::UnsafeAddress => (
                AndroidAppLinksHostState::UnsafeAddress,
                "ANDROID_APP_LINKS_UNSAFE_ADDRESS",
            ),
            FetchError::ResponseTooLarge => (
                AndroidAppLinksHostState::ResponseTooLarge,
                "ANDROID_APP_LINKS_RESPONSE_TOO_LARGE",
            ),
            FetchError::RequestFailed => (
                AndroidAppLinksHostState::RequestFailed,
                "ANDROID_APP_LINKS_REQUEST_FAILED",
            ),
        };
        Self::failure(host, state, code, None)
    }

    fn failure(
        host: &str,
        state: AndroidAppLinksHostState,
        result_code: &'static str,
        http_status: Option<u16>,
    ) -> Self {
        Self {
            host: host.to_owned(),
            state,
            remote_fingerprint_count: None,
            missing_on_remote_count: None,
            additional_on_remote_count: None,
            http_status,
            result_code,
        }
    }

    fn comparison(
        host: &str,
        http_status: u16,
        local: &BTreeSet<Fingerprint>,
        remote: &BTreeSet<Fingerprint>,
    ) -> Self {
        let missing = local.difference(remote).count();
        let additional = remote.difference(local).count();
        let (state, result_code) = match (missing, additional) {
            (0, 0) => (AndroidAppLinksHostState::Exact, "ANDROID_APP_LINKS_EXACT"),
            (0, _) => (
                AndroidAppLinksHostState::LocalCovered,
                "ANDROID_APP_LINKS_LOCAL_COVERED",
            ),
            (_, 0) => (
                AndroidAppLinksHostState::MissingOnRemote,
                "ANDROID_APP_LINKS_MISSING_ON_REMOTE",
            ),
            _ => (
                AndroidAppLinksHostState::Mismatch,
                "ANDROID_APP_LINKS_MISMATCH",
            ),
        };
        Self {
            host: host.to_owned(),
            state,
            remote_fingerprint_count: Some(remote.len()),
            missing_on_remote_count: Some(missing),
            additional_on_remote_count: Some(additional),
            http_status: Some(http_status),
            result_code,
        }
    }
}

#[cfg(test)]
mod tests;
