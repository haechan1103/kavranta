use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use env_core::{
    AddVariableRequest, ClassificationSource, CodexAccess, CreateEnvFileRequest,
    CreateGroupRequest, EnvError, EnvErrorCode, LinkRequest, MigrationPlan, MoveVariableRequest,
    OpaqueValueCopyRequest, ProjectService, RedactedOccurrenceReference, RedactedValueState,
    RenameGroupRequest, SaveDescriptionRequest, SaveValueRequest,
};
use env_provider::action_pack::ActionExecutionRequest;
use env_provider::android_app_links::AndroidAppLinksVerificationRequest;
use env_provider::provider_push::{ProviderCompareRequest, ProviderPushRequest};
use env_registry::ProjectRegistration;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

mod broker;
mod stdin_value;

pub(crate) use broker::append_audit_event;
pub use broker::guard::guard_hook_decision;
pub use broker::tool_schema::tool_definitions;
#[cfg(test)]
use broker::{audit_category, normalize_agent_host};
pub use stdin_value::{StdinValueApplyProjection, StdinValueError};

const PLAN_TTL: Duration = Duration::from_secs(300);

pub struct Broker {
    plans: Mutex<HashMap<String, StoredPlan>>,
    next_plan_id: AtomicU64,
    registered_roots_override: Option<Vec<PathBuf>>,
    provider_app_data_override: Option<PathBuf>,
    workspace_root_override: Option<PathBuf>,
    agent_host: Mutex<Option<&'static str>>,
    #[cfg(test)]
    _test_app_data: Option<tempfile::TempDir>,
}

struct StoredPlan {
    project_id: String,
    root: PathBuf,
    expires_at: Instant,
    operation: PlannedOperation,
    affected_files: Vec<String>,
    keys: Vec<String>,
    risk: &'static str,
}

enum PlannedOperation {
    RegisterProject,
    SetAllowedValue(SaveValueRequest),
    CreateEnvFile(CreateEnvFileRequest),
    AddVariable(AddVariableRequest),
    CreateGroup(CreateGroupRequest),
    RenameGroup(RenameGroupRequest),
    MoveVariable(MoveVariableRequest),
    UpdateDescription(SaveDescriptionRequest),
    Link(LinkRequest),
    Detach {
        link_id: String,
        file: String,
    },
    Classification {
        key: String,
        access: CodexAccess,
    },
    Migration(MigrationPlan),
    OpaqueProjectCopy {
        source_root: PathBuf,
        source_project_id: String,
        request: OpaqueValueCopyRequest,
    },
    ProviderPush(ProviderPushRequest),
    InstallActionPack {
        manifest: env_provider::action_pack::ActionPackManifest,
        replace: bool,
    },
    ActionPack(ActionExecutionRequest),
    SetVariableGuide {
        key: String,
        markdown: Option<String>,
    },
    RecordDeploymentTarget {
        target: env_core::DeploymentTarget,
    },
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PlanProjection {
    plan_id: String,
    project_id: String,
    summary: String,
    affected_files: Vec<String>,
    keys: Vec<String>,
    risk: &'static str,
    expires_in_seconds: u64,
    migration: Option<env_core::MigrationPreview>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct InspectArgs {
    project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct PlanRegisterProjectArgs {}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FindReusableVariableArgs {
    project_path: String,
    key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct FindRegisteredProjectsArgs {
    query: String,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SearchRegisteredVariableSourcesArgs {
    query: String,
    project_id: Option<String>,
    #[serde(default)]
    include_empty: bool,
    limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanOpaqueProjectCopyArgs {
    project_path: String,
    source_project_id: String,
    source_file: String,
    target_file: String,
    key: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReusableVariableCandidate {
    project_id: String,
    project_name: String,
    display_path: String,
    files: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RegisteredProjectCandidate {
    project_id: String,
    project_name: String,
    project_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RegisteredVariableSourceCandidate {
    project_id: String,
    project_name: String,
    project_path: String,
    key: String,
    codex_access: CodexAccess,
    occurrences: Vec<RedactedOccurrenceReference>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ValueArgs {
    project_path: String,
    file: String,
    key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanValueArgs {
    project_path: String,
    file: String,
    key: String,
    new_value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanStdinValueArgs {
    project_path: String,
    file: String,
    key: String,
    #[serde(default)]
    trim_final_newline: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanCreateEnvFileArgs {
    project_path: String,
    file: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanAddVariableArgs {
    project_path: String,
    file: String,
    key: String,
    group: String,
    #[serde(default)]
    description: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanCreateGroupArgs {
    project_path: String,
    file: String,
    name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanRenameGroupArgs {
    project_path: String,
    file: String,
    current_name: String,
    new_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanMoveVariableArgs {
    project_path: String,
    file: String,
    key: String,
    target_group: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanDescriptionArgs {
    project_path: String,
    file: String,
    key: String,
    lines: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanLinkArgs {
    project_path: String,
    key: String,
    files: Vec<String>,
    source_file: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanDetachArgs {
    project_path: String,
    link_id: String,
    file: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanClassificationArgs {
    project_path: String,
    key: String,
    access: CodexAccess,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanMigrationArgs {
    project_path: String,
    file: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ListProvidersArgs {
    project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ScanExposureArgs {
    project_path: String,
    #[serde(default)]
    deep: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct RequestValueInputArgs {
    project_path: String,
    entries: Vec<env_core::SecretInputEntry>,
    #[serde(default)]
    timeout_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanSetVariableGuideArgs {
    project_path: String,
    key: String,
    #[serde(default)]
    markdown: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PlanRecordDeploymentTargetArgs {
    project_path: String,
    provider: String,
    label: Option<String>,
    repository: Option<String>,
    environment: Option<String>,
    worker: Option<String>,
    eas_project: Option<String>,
    #[serde(default)]
    eas_environments: Vec<String>,
    aws_profile: Option<String>,
    aws_region: Option<String>,
    aws_path_prefix: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanActionArgs {
    project_path: String,
    pack_id: String,
    file: String,
    bindings: std::collections::BTreeMap<String, String>,
    #[serde(default)]
    body: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanInstallActionPackArgs {
    project_path: String,
    manifest: env_provider::action_pack::ActionPackManifest,
    #[serde(default)]
    replace: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ListTeamChannelsArgs {
    project_path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BrokerTeamChannelProjection {
    id: String,
    name: String,
    readable: bool,
    publishable: Option<bool>,
    packages: Vec<env_team::TeamChannelPackage>,
    requires_human_passphrase: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct PlanProviderPushArgs {
    project_path: String,
    provider: String,
    file: String,
    selections: Vec<env_provider::provider_push::ProviderSelection>,
    repository: Option<String>,
    github_environment: Option<String>,
    worker: Option<String>,
    cloudflare_environment: Option<String>,
    eas_project: Option<String>,
    #[serde(default)]
    eas_environments: Vec<String>,
    personal_target: Option<String>,
    aws_profile: Option<String>,
    aws_region: Option<String>,
    aws_path_prefix: Option<String>,
    aws_kms_key_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CompareDeploymentValuesArgs {
    project_path: String,
    provider: String,
    file: String,
    keys: Vec<String>,
    aws_profile: Option<String>,
    aws_region: Option<String>,
    aws_path_prefix: Option<String>,
    runtime_target_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct VerifyAndroidAppLinksArgs {
    project_path: String,
    file: String,
    key: String,
    package_name: String,
    hosts: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ApplyArgs {
    plan_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuditEvent<'a> {
    timestamp_ms: u64,
    project_id: &'a str,
    actor: String,
    category: &'static str,
    operation: &'a str,
    relative_paths: &'a [String],
    variable_names: &'a [String],
    policy_decision: &'a str,
    outcome: &'static str,
    result_code: &'a str,
}

pub fn apply_stdin_value_from_default_paths<R: std::io::Read>(
    plan_id: &str,
    trim_final_newline: bool,
    reader: R,
) -> Result<StdinValueApplyProjection, StdinValueError> {
    let app_data = broker::provider_app_data().map_err(StdinValueError::from)?;
    let registry_path = std::env::var_os("KAVRANTA_REGISTRY_PATH")
        .or_else(|| std::env::var_os("ENV_MANAGER_REGISTRY_PATH"))
        .map(PathBuf::from)
        .unwrap_or_else(|| app_data.join("projects.json"));
    stdin_value::apply_plan(
        &app_data,
        &registry_path,
        plan_id,
        trim_final_newline,
        reader,
    )
}

fn parse<T: for<'de> Deserialize<'de>>(value: Value) -> Result<T, EnvError> {
    serde_json::from_value(value)
        .map_err(|error| EnvError::invalid(describe_argument_error(&error.to_string())))
}

/// A value-free, actionable description of a tool-argument failure.
///
/// The previous message was a single generic sentence, so an unexpected field, a missing
/// field, and a wrong type were indistinguishable. A caller that passed one extra field saw
/// "the tool arguments are not valid" and reasonably concluded the tool was broken rather
/// than that its own call was malformed.
///
/// The raw `serde_json` message is never forwarded. It embeds the submitted value for a type
/// error (`invalid type: string "..."`), and that value can be a secret. Only field names are
/// echoed, and only when they are plain identifiers, because a field name comes from the
/// tool schema rather than from caller data.
fn describe_argument_error(message: &str) -> String {
    if let Some(field) = named_field(message, "unknown field ") {
        return format!("예상하지 못한 인자입니다: {field}. 이 도구가 받는 인자를 확인해주세요.");
    }
    if let Some(field) = named_field(message, "missing field ") {
        return format!("필수 인자가 빠졌습니다: {field}.");
    }
    // Type and value failures embed the submitted value, so only the kind is reported.
    "인자 형식이 이 도구가 요구하는 형식과 다릅니다.".to_owned()
}

/// Extract the field name from a `serde` message such as ``unknown field `deep`, ...``.
fn named_field<'a>(message: &'a str, marker: &str) -> Option<&'a str> {
    let rest = message.get(message.find(marker)? + marker.len()..)?;
    let open = rest.find('`')? + 1;
    let close = rest.get(open..)?.find('`')? + open;
    let field = rest.get(open..close)?;
    // A plain, short identifier only, so no caller-supplied text can ride along.
    (!field.is_empty()
        && field.len() <= 40
        && field.chars().all(|c| c.is_ascii_alphanumeric() || c == '_'))
    .then_some(field)
}

fn serialize_result<T: Serialize>(result: Result<T, EnvError>) -> Result<Value, EnvError> {
    result.and_then(|value| serde_json::to_value(value).map_err(EnvError::serialization))
}

#[cfg(test)]
#[path = "broker/tests/mod.rs"]
mod tests;

#[cfg(test)]
mod argument_error_tests {
    use super::describe_argument_error;

    #[test]
    fn an_unknown_field_is_named() {
        let message = "unknown field `deep`, expected one of `projectPath`";
        let described = describe_argument_error(message);
        assert!(described.contains("deep"), "got: {described}");
    }

    #[test]
    fn a_missing_field_is_named() {
        let described = describe_argument_error("missing field `projectPath`");
        assert!(described.contains("projectPath"), "got: {described}");
    }

    /// The submitted value must never be echoed, because it can be a secret. `serde_json`
    /// embeds it for type errors.
    #[test]
    fn a_type_error_never_echoes_the_submitted_value() {
        let message = "invalid type: string \"fake-submitted-value\", expected u32";
        let described = describe_argument_error(message);
        assert!(
            !described.contains("fake-submitted-value"),
            "the value leaked: {described}"
        );
    }

    /// A field name is echoed only when it is a plain identifier, so a caller cannot smuggle
    /// arbitrary text into the message through a crafted key.
    #[test]
    fn only_plain_identifiers_are_echoed() {
        // Assembled from fragments so this file never contains a literal that the
        // repository boundary scan reads as a live credential.
        let shaped = format!("sk-proj-{}", "not-an-identifier");
        for message in [
            format!("unknown field `{shaped}`, expected one of `projectPath`"),
            "unknown field `has spaces`, expected one of `projectPath`".to_owned(),
            "unknown field ``, expected one of `projectPath`".to_owned(),
        ] {
            let described = describe_argument_error(&message);
            assert!(
                !described.contains("sk-proj") && !described.contains("has spaces"),
                "a non-identifier leaked: {described}"
            );
        }
    }

    #[test]
    fn the_three_failure_kinds_read_differently() {
        let unknown =
            describe_argument_error("unknown field `deep`, expected one of `projectPath`");
        let missing = describe_argument_error("missing field `projectPath`");
        let type_error = describe_argument_error("invalid type: boolean, expected a string");
        assert_ne!(unknown, missing);
        assert_ne!(unknown, type_error);
        assert_ne!(missing, type_error);
    }
}
