use std::path::{Path, PathBuf};

use super::error::{ProviderPushError, invalid_target};
use super::model::{
    AWS_SECRETS_MANAGER_ID, AWS_SSM_PARAMETER_STORE_ID, CLOUDFLARE_WORKERS_ID, EXPO_EAS_ID,
    GITHUB_ACTIONS_ID,
};

pub(super) fn source_directory(
    root: &Path,
    source_file: &str,
) -> Result<PathBuf, ProviderPushError> {
    let relative = Path::new(source_file);
    if relative.is_absolute()
        || relative
            .components()
            .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err(invalid_target());
    }
    let source = root.join(relative);
    Ok(source
        .parent()
        .filter(|path| path.starts_with(root))
        .unwrap_or(root)
        .to_owned())
}

pub(super) fn validate_repository(value: &str) -> Result<(), ProviderPushError> {
    let Some((owner, repository)) = value.split_once('/') else {
        return Err(invalid_target());
    };
    if owner.is_empty() || repository.is_empty() || repository.contains('/') {
        return Err(invalid_target());
    }
    validate_simple_target(owner)?;
    validate_simple_target(repository)
}

pub(super) fn optional_target(value: Option<&str>) -> Result<Option<&str>, ProviderPushError> {
    let value = value.map(str::trim).filter(|value| !value.is_empty());
    if let Some(value) = value {
        validate_simple_target(value)?;
    }
    Ok(value)
}

pub(super) fn validate_simple_target(value: &str) -> Result<(), ProviderPushError> {
    let valid = !value.is_empty()
        && value.len() <= 100
        && !value.starts_with('-')
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'));
    if valid { Ok(()) } else { Err(invalid_target()) }
}

/// Validate a candidate recorded deployment target before it is stored.
///
/// This lives in `env-provider` rather than `env-core` on purpose: `env-core` owns the
/// manifest structure but must stay independent of provider catalogs and transport
/// concerns. Exact provider facts live in `config/provider-compatibility.json`, and this
/// function is the single place that turns a catalog capability into a rule.
///
/// A recorded target carries destination metadata only, so a field that could hold a
/// value is rejected outright rather than trimmed.
pub fn validate_recorded_target(
    target: &env_core::DeploymentTarget,
) -> Result<(), env_core::EnvError> {
    let invalid = |message: &str| env_core::EnvError::invalid(message);
    for (field, value) in [
        ("label", target.label.as_deref()),
        ("repository", target.repository.as_deref()),
        ("environment", target.environment.as_deref()),
        ("worker", target.worker.as_deref()),
        ("easProject", target.eas_project.as_deref()),
        ("awsProfile", target.aws_profile.as_deref()),
        ("awsRegion", target.aws_region.as_deref()),
        ("awsPathPrefix", target.aws_path_prefix.as_deref()),
    ] {
        if let Some(value) = value
            && (value.len() > MAX_TARGET_FIELD_BYTES || value.contains('\n'))
        {
            return Err(invalid(&format!(
                "배포 대상 {field} 값이 너무 길거나 개행을 포함합니다."
            )));
        }
    }
    for environment in &target.eas_environments {
        if environment.len() > MAX_TARGET_FIELD_BYTES || environment.contains('\n') {
            return Err(invalid(
                "배포 대상 easEnvironments 값이 너무 길거나 개행을 포함합니다.",
            ));
        }
    }

    match target.provider.as_str() {
        GITHUB_ACTIONS_ID => {
            require_no_aws(target)?;
            require_no_cloudflare(target)?;
            require_no_eas(target)?;
            if target.repository.as_deref().is_none_or(str::is_empty) {
                return Err(invalid("GitHub Actions 대상에는 repository가 필요합니다."));
            }
            if let Some(repository) = target.repository.as_deref()
                && !is_repository_slug(repository)
            {
                return Err(invalid("repository는 owner/name 형식이어야 합니다."));
            }
        }
        CLOUDFLARE_WORKERS_ID => {
            require_no_aws(target)?;
            require_no_eas(target)?;
            if target.repository.is_some() || target.environment.is_some() {
                return Err(invalid(
                    "Cloudflare Workers 대상에는 repository나 environment를 쓸 수 없습니다.",
                ));
            }
            if target.worker.as_deref().is_none_or(str::is_empty) {
                return Err(invalid("Cloudflare Workers 대상에는 worker가 필요합니다."));
            }
        }
        EXPO_EAS_ID => {
            require_no_aws(target)?;
            require_no_cloudflare(target)?;
            if target.repository.is_some()
                || target.environment.is_some()
                || target.worker.is_some()
            {
                return Err(invalid(
                    "Expo EAS 대상에는 repository, environment, worker를 쓸 수 없습니다.",
                ));
            }
            if target.eas_project.as_deref().is_none_or(str::is_empty) {
                return Err(invalid("Expo EAS 대상에는 easProject가 필요합니다."));
            }
            if target.eas_environments.is_empty() {
                return Err(invalid(
                    "Expo EAS 대상에는 easEnvironments가 최소 하나 필요합니다.",
                ));
            }
        }
        AWS_SECRETS_MANAGER_ID | AWS_SSM_PARAMETER_STORE_ID => {
            require_no_cloudflare(target)?;
            require_no_eas(target)?;
            if target.repository.is_some()
                || target.environment.is_some()
                || target.worker.is_some()
                || target.eas_project.is_some()
                || !target.eas_environments.is_empty()
            {
                return Err(invalid(
                    "AWS 대상에는 repository, environment, worker, easProject를 쓸 수 없습니다.",
                ));
            }
        }
        _ => {
            return Err(invalid(&format!(
                "공식 provider가 아니어서 배포 대상으로 기록할 수 없습니다: {}",
                target.provider
            )));
        }
    }
    Ok(())
}

const MAX_TARGET_FIELD_BYTES: usize = 256;

fn is_repository_slug(repository: &str) -> bool {
    let mut parts = repository.split('/');
    let owner = parts.next().unwrap_or_default();
    let name = parts.next().unwrap_or_default();
    parts.next().is_none()
        && !owner.is_empty()
        && !name.is_empty()
        && [owner, name].iter().all(|part| {
            part.chars()
                .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'))
        })
}

fn require_no_aws(target: &env_core::DeploymentTarget) -> Result<(), env_core::EnvError> {
    if target.aws_profile.is_some()
        || target.aws_region.is_some()
        || target.aws_path_prefix.is_some()
    {
        return Err(env_core::EnvError::invalid(
            "해당 provider에는 AWS 대상 정보를 쓸 수 없습니다.",
        ));
    }
    Ok(())
}

fn require_no_cloudflare(target: &env_core::DeploymentTarget) -> Result<(), env_core::EnvError> {
    if target.worker.is_some() {
        return Err(env_core::EnvError::invalid(
            "해당 provider에는 worker를 쓸 수 없습니다.",
        ));
    }
    Ok(())
}

fn require_no_eas(target: &env_core::DeploymentTarget) -> Result<(), env_core::EnvError> {
    if target.eas_project.is_some() || !target.eas_environments.is_empty() {
        return Err(env_core::EnvError::invalid(
            "해당 provider에는 EAS 대상 정보를 쓸 수 없습니다.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_closed_provider_target_shapes() {
        assert!(validate_repository("owner/repository").is_ok());
        assert!(validate_repository("owner").is_err());
        assert!(validate_repository("owner/repo/extra").is_err());
        assert!(validate_repository("--owner/repository").is_err());
        assert!(validate_simple_target("worker-production").is_ok());
        assert!(validate_simple_target("--config").is_err());
        assert!(validate_simple_target("worker name").is_err());
    }
}
