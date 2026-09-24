mod discovery;
mod effective;
mod error;
mod export;
mod exposure;
mod git_safety;
mod guide;
mod manifest;
mod migration;
mod model;
mod parser;
mod policy;
mod provider_push;
mod secret_input;
mod service;
mod team_import;
mod transaction;

pub use discovery::{DiscoveryOptions, discover_env_files, is_env_candidate};
pub use effective::{
    EffectiveContext, EffectiveOccurrence, EffectiveProjection, FrameworkKind, resolve_effective,
};
pub use error::{EnvError, EnvErrorCode, EnvResult};
pub use export::{ExportFormat, ExportOccurrence, ExportSummary, export_project_env};
pub use exposure::{
    ExposureCounts, ExposureDisposition, ExposureFinding, ExposureKind, ExposureProjection,
    ExposureSeverity, ExposureState,
};
pub use git_safety::{
    GitSafetyProjection, GitSafetyState, GitignoreUpdateSummary, apply_gitignore_guard,
    inspect_git_safety,
};
pub use guide::{
    GuideAttachment, MAX_ATTACHMENT_BYTES, MAX_GUIDE_BYTES, guide_relative_path, read_guide,
    read_guide_attachment, remove_guide, write_guide,
};
pub use manifest::{
    AllowedExposureFinding, ClassificationSource, CodexAccess, ExposureConfig, LinkGroup,
    LinkMember, MANAGED_DIR_NAME, MANIFEST_FILE_NAME, Manifest, ManifestStore, VariablePolicy,
    validate_display_name,
};
pub use migration::{MigrationPlan, MigrationPreview, MigrationSuggestion};
pub use model::{
    ClassificationReviewProjection, ClassificationReviewReason, FileProjection, GroupProjection,
    OccurrenceProjection, ProjectProjection, RedactedValueState,
};
pub use parser::{AssignmentRef, Document, NewlineStyle, Node, Span};
pub use policy::{
    ClassificationSuggestion, ClientExposureWarning, default_access, detect_client_exposure,
    suggest_access,
};
pub use provider_push::ProviderValue;
pub use secret_input::{
    SECRET_INPUT_SOCKET_FILE, SecretInputEntry, SecretInputOutcome, SecretInputRequest,
    SecretInputResponse, SecretInputResult, secret_input_socket_path,
};
pub use service::{
    AddVariableRequest, CreateEnvFileRequest, CreateGroupRequest, DeleteVariableRequest,
    LinkRequest, MoveVariableRequest, MutationSummary, OpaqueValueCopyRequest,
    PreparedOpaqueValueWrite, ProjectService, RedactedOccurrenceReference, RedactedVariableMatch,
    RenameEnvFileRequest, RenameEnvFileSummary, RenameGroupRequest, SaveDescriptionRequest,
    SaveValueRequest,
};
pub use team_import::{
    TeamImportFileProjection, TeamImportOccurrenceProjection, TeamImportOccurrenceState,
    TeamImportPlan, TeamImportPreview, TeamImportSummary, TeamImportValueSide,
    plan_encrypted_team_import,
};
pub use transaction::{FileRevision, PlannedFileChange, TransactionPlan};
