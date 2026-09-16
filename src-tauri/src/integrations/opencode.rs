use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{SystemTime, UNIX_EPOCH};

use directories::BaseDirs;
use serde_json::Value;

use super::catalog::copy_directory;
use super::command::background_command;
use super::model::{
    IntegrationError, KAVRANTA_REPOSITORY, MCP_SERVER_NAME, PLUGIN_NAME, agent_bundle_version,
};

const MAX_CONFIG_BYTES: u64 = 1_048_576;
const MANIFEST_PATH: &str = "kavranta/manifest.json";
const GUARD_PATH: &str = "plugins/kavranta.js";
const SKILL_PATH: &str = "skills/kavranta-env";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum McpConfigurationState {
    Missing,
    Current,
    OwnedStale,
    Conflict,
}

pub(super) fn config_root() -> Option<PathBuf> {
    let base = BaseDirs::new()?;
    Some(config_root_for(
        base.home_dir(),
        std::env::var_os("XDG_CONFIG_HOME"),
        cfg!(windows),
    ))
}

pub(super) fn config_root_for(home: &Path, xdg: Option<OsString>, windows: bool) -> PathBuf {
    if !windows
        && let Some(root) = xdg.map(PathBuf::from)
        && root.is_absolute()
    {
        return root.join("opencode");
    }
    home.join(".config/opencode")
}

pub(super) fn installed_bundle() -> Option<(String, PathBuf)> {
    installed_bundle_at(&config_root()?)
}

pub(super) fn installed_bundle_at(root: &Path) -> Option<(String, PathBuf)> {
    let managed_root = root.join("kavranta");
    let manifest = read_json5(&managed_root.join("manifest.json")).ok()?;
    let version = manifest.get("version")?.as_str()?.to_owned();
    Some((version, managed_root))
}

pub(super) fn installed_bundle_is_official_at(root: &Path) -> bool {
    read_json5(&root.join(MANIFEST_PATH)).is_ok_and(|manifest| {
        manifest.get("name").and_then(Value::as_str) == Some(PLUGIN_NAME)
            && manifest.get("repository").and_then(Value::as_str) == Some(KAVRANTA_REPOSITORY)
    })
}

pub(super) fn connection_configuration_is_current(broker: &Path, app_data: &Path) -> bool {
    config_root().is_some_and(|root| {
        installed_files_are_current_at(&root, broker)
            && mcp_configuration_state_at(&root, broker, app_data)
                .is_ok_and(|state| state == McpConfigurationState::Current)
    })
}

pub(super) fn install(
    catalog: &Path,
    executable: &Path,
    broker: &Path,
    app_data: &Path,
) -> Result<(), IntegrationError> {
    let root = config_root().ok_or(IntegrationError {
        code: "OPENCODE_CONFIG_UNAVAILABLE",
        message: "OpenCode 전역 설정 경로를 확인하지 못했습니다.",
    })?;
    install_at(
        &catalog.join("plugins").join(PLUGIN_NAME),
        &root,
        executable,
        broker,
        app_data,
    )
}

pub(super) fn install_at(
    source: &Path,
    root: &Path,
    executable: &Path,
    broker: &Path,
    app_data: &Path,
) -> Result<(), IntegrationError> {
    validate_source(source, broker)?;
    let state = mcp_configuration_state_at(root, broker, app_data)?;
    let owns_existing_bundle = installed_bundle_is_official_at(root);
    if state == McpConfigurationState::Conflict
        || (state == McpConfigurationState::OwnedStale && !owns_existing_bundle)
    {
        return Err(IntegrationError {
            code: "OPENCODE_CONFIGURATION_CONFLICT",
            message: "같은 이름의 다른 OpenCode 연결이 있어 덮어쓰지 않았습니다. OpenCode 전역 설정에서 kavranta MCP 항목을 확인해주세요.",
        });
    }
    install_managed_files_at(source, root, broker)?;

    if matches!(
        state,
        McpConfigurationState::Missing | McpConfigurationState::OwnedStale
    ) {
        configure_mcp(executable, broker, app_data)?;
    }
    if mcp_configuration_state_at(root, broker, app_data)? != McpConfigurationState::Current {
        return Err(IntegrationError {
            code: "OPENCODE_CONFIGURATION_NOT_APPLIED",
            message: "OpenCode가 Kavranta MCP 설정을 적용하지 않았습니다. 전역 OpenCode 설정을 확인해주세요.",
        });
    }
    Ok(())
}

pub(super) fn install_managed_files_at(
    source: &Path,
    root: &Path,
    broker: &Path,
) -> Result<(), IntegrationError> {
    let targets = [
        root.join(MANIFEST_PATH),
        root.join(GUARD_PATH),
        root.join(SKILL_PATH),
    ];
    if targets.iter().any(|path| path.exists()) && !installed_bundle_is_official_at(root) {
        return Err(IntegrationError {
            code: "OPENCODE_BUNDLE_CONFLICT",
            message: "OpenCode 설정 경로에 앱이 소유하지 않은 Kavranta 파일이 있어 덮어쓰지 않았습니다.",
        });
    }
    for parent in [
        root.join("kavranta"),
        root.join("plugins"),
        root.join("skills"),
    ] {
        fs::create_dir_all(parent).map_err(|_| IntegrationError {
            code: "OPENCODE_INSTALL_FAILED",
            message: "OpenCode 연동 설치 디렉터리를 만들지 못했습니다.",
        })?;
    }

    let stage = tempfile::Builder::new()
        .prefix(".kavranta-install-")
        .tempdir_in(root)
        .map_err(|_| IntegrationError {
            code: "OPENCODE_INSTALL_FAILED",
            message: "OpenCode 연동 임시 설치 디렉터리를 만들지 못했습니다.",
        })?;
    let staged_manifest = stage.path().join("manifest.json");
    let staged_guard = stage.path().join("kavranta.js");
    let staged_skill = stage.path().join("kavranta-env");
    fs::copy(source.join("opencode/manifest.json"), &staged_manifest).map_err(|_| {
        IntegrationError {
            code: "OPENCODE_INSTALL_FAILED",
            message: "OpenCode 연동 manifest를 준비하지 못했습니다.",
        }
    })?;
    fs::copy(source.join("opencode/kavranta-guard.js"), &staged_guard).map_err(|_| {
        IntegrationError {
            code: "OPENCODE_INSTALL_FAILED",
            message: "OpenCode Guard를 준비하지 못했습니다.",
        }
    })?;
    copy_directory(&source.join("skills/kavranta-env"), &staged_skill)?;

    let staged = [staged_manifest, staged_guard, staged_skill];
    replace_targets(&staged, &targets)?;
    if !installed_files_are_current_at(root, broker) {
        return Err(IntegrationError {
            code: "OPENCODE_VALIDATION_FAILED",
            message: "설치된 OpenCode 연동 파일을 검증하지 못했습니다.",
        });
    }
    Ok(())
}

pub(super) fn mcp_configuration_state_at(
    root: &Path,
    broker: &Path,
    app_data: &Path,
) -> Result<McpConfigurationState, IntegrationError> {
    let entries = mcp_entries(root)?;
    if entries.is_empty() {
        return Ok(McpConfigurationState::Missing);
    }
    if entries.len() == 1 && mcp_entry_is_current(&entries[0], broker, app_data) {
        return Ok(McpConfigurationState::Current);
    }
    if entries.len() == 1 && entries.iter().all(mcp_entry_is_owned) {
        return Ok(McpConfigurationState::OwnedStale);
    }
    Ok(McpConfigurationState::Conflict)
}

pub(super) fn mcp_add_args(broker: &Path, app_data: &Path) -> Vec<OsString> {
    vec![
        "--pure".into(),
        "mcp".into(),
        "add".into(),
        MCP_SERVER_NAME.into(),
        "--env".into(),
        format!(
            "KAVRANTA_AUDIT_DIR={}",
            app_data.join("agent-activity").to_string_lossy()
        )
        .into(),
        "--env".into(),
        format!("KAVRANTA_APP_DATA_DIR={}", app_data.to_string_lossy()).into(),
        "--env".into(),
        "KAVRANTA_AGENT_HOST=opencode".into(),
        "--".into(),
        broker.as_os_str().to_owned(),
    ]
}

fn configure_mcp(
    executable: &Path,
    broker: &Path,
    app_data: &Path,
) -> Result<(), IntegrationError> {
    let success = background_command(executable)
        .args(mcp_add_args(broker, app_data))
        .env("OPENCODE_DISABLE_AUTOUPDATE", "1")
        .env("OPENCODE_DISABLE_MODELS_FETCH", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok_and(|status| status.success());
    if success {
        Ok(())
    } else {
        Err(IntegrationError {
            code: "OPENCODE_MCP_INSTALL_FAILED",
            message: "OpenCode에 Kavranta MCP 연결을 추가하지 못했습니다.",
        })
    }
}

fn validate_source(source: &Path, broker: &Path) -> Result<(), IntegrationError> {
    let manifest = read_json5(&source.join("opencode/manifest.json"))?;
    let guard = fs::read_to_string(source.join("opencode/kavranta-guard.js")).map_err(|_| {
        IntegrationError {
            code: "OPENCODE_BUNDLE_INVALID",
            message: "OpenCode Guard 원본을 읽지 못했습니다.",
        }
    })?;
    let expected_broker =
        serde_json::to_string(&broker.to_string_lossy()).map_err(|_| IntegrationError {
            code: "OPENCODE_BUNDLE_INVALID",
            message: "OpenCode Guard broker 경로를 직렬화하지 못했습니다.",
        })?;
    if manifest.get("name").and_then(Value::as_str) != Some(PLUGIN_NAME)
        || manifest.get("version").and_then(Value::as_str) != Some(agent_bundle_version())
        || manifest.get("repository").and_then(Value::as_str) != Some(KAVRANTA_REPOSITORY)
        || !source.join("skills/kavranta-env/SKILL.md").is_file()
        || !guard.contains(&format!("const KAVRANTA_BROKER = {expected_broker};"))
        || guard.contains("__KAVRANTA_BROKER_PATH__")
    {
        return Err(IntegrationError {
            code: "OPENCODE_BUNDLE_INVALID",
            message: "OpenCode 연동 번들 구성이 올바르지 않습니다.",
        });
    }
    Ok(())
}

fn installed_files_are_current_at(root: &Path, broker: &Path) -> bool {
    let Some((version, _)) = installed_bundle_at(root) else {
        return false;
    };
    let Ok(guard) = fs::read_to_string(root.join(GUARD_PATH)) else {
        return false;
    };
    let Ok(expected_broker) = serde_json::to_string(&broker.to_string_lossy()) else {
        return false;
    };
    version == agent_bundle_version()
        && installed_bundle_is_official_at(root)
        && root.join(SKILL_PATH).join("SKILL.md").is_file()
        && guard.contains("Managed by Kavranta Desktop")
        && guard.contains(&format!("const KAVRANTA_BROKER = {expected_broker};"))
        && !guard.contains("__KAVRANTA_BROKER_PATH__")
}

fn mcp_entries(root: &Path) -> Result<Vec<Value>, IntegrationError> {
    let mut entries = Vec::new();
    for name in ["opencode.json", "opencode.jsonc"] {
        let path = root.join(name);
        if !path.exists() {
            continue;
        }
        let config = read_json5(&path).map_err(|_| IntegrationError {
            code: "OPENCODE_CONFIG_INVALID",
            message: "OpenCode 전역 설정을 안전하게 해석하지 못했습니다.",
        })?;
        let Some(config) = config.as_object() else {
            return Err(invalid_config_error());
        };
        if let Some(mcp) = config.get("mcp") {
            let Some(mcp) = mcp.as_object() else {
                return Err(invalid_config_error());
            };
            if let Some(entry) = mcp.get(MCP_SERVER_NAME) {
                entries.push(entry.clone());
            }
        }
    }
    Ok(entries)
}

fn mcp_entry_is_current(entry: &Value, broker: &Path, app_data: &Path) -> bool {
    let expected_broker = broker.to_string_lossy();
    let expected_audit = app_data.join("agent-activity");
    let expected_audit = expected_audit.to_string_lossy();
    let expected_app_data = app_data.to_string_lossy();
    let Some(command) = entry.get("command").and_then(Value::as_array) else {
        return false;
    };
    let Some(environment) = entry.get("environment").and_then(Value::as_object) else {
        return false;
    };
    entry.get("type").and_then(Value::as_str) == Some("local")
        && command.len() == 1
        && command.first().and_then(Value::as_str) == Some(expected_broker.as_ref())
        && entry.get("enabled").and_then(Value::as_bool) != Some(false)
        && environment
            .get("KAVRANTA_AUDIT_DIR")
            .and_then(Value::as_str)
            == Some(expected_audit.as_ref())
        && environment
            .get("KAVRANTA_APP_DATA_DIR")
            .and_then(Value::as_str)
            == Some(expected_app_data.as_ref())
        && environment
            .get("KAVRANTA_AGENT_HOST")
            .and_then(Value::as_str)
            == Some("opencode")
}

fn mcp_entry_is_owned(entry: &Value) -> bool {
    let Some(command) = entry.get("command").and_then(Value::as_array) else {
        return false;
    };
    let Some(executable) = command.first().and_then(Value::as_str) else {
        return false;
    };
    let Some(environment) = entry.get("environment").and_then(Value::as_object) else {
        return false;
    };
    entry.get("type").and_then(Value::as_str) == Some("local")
        && command.len() == 1
        && Path::new(executable)
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name == "kavranta-broker" || name == "kavranta-broker.exe")
        && environment
            .get("KAVRANTA_AGENT_HOST")
            .and_then(Value::as_str)
            == Some("opencode")
        && environment
            .get("KAVRANTA_AUDIT_DIR")
            .is_some_and(Value::is_string)
        && environment
            .get("KAVRANTA_APP_DATA_DIR")
            .is_some_and(Value::is_string)
}

fn replace_targets(staged: &[PathBuf; 3], targets: &[PathBuf; 3]) -> Result<(), IntegrationError> {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let backups = targets
        .iter()
        .enumerate()
        .map(|(index, target)| {
            target.with_file_name(format!(
                ".kavranta-backup-{}-{nonce}-{index}",
                std::process::id()
            ))
        })
        .collect::<Vec<_>>();
    let mut backed_up = Vec::new();
    for (index, target) in targets.iter().enumerate() {
        if target.exists() {
            if fs::rename(target, &backups[index]).is_err() {
                restore_backups(targets, &backups, &backed_up);
                return Err(install_swap_error());
            }
            backed_up.push(index);
        }
    }

    let mut installed: Vec<usize> = Vec::new();
    for (index, source) in staged.iter().enumerate() {
        if fs::rename(source, &targets[index]).is_err() {
            for installed_index in installed {
                remove_path(&targets[installed_index]);
            }
            restore_backups(targets, &backups, &backed_up);
            return Err(install_swap_error());
        }
        installed.push(index);
    }
    for index in backed_up {
        remove_path(&backups[index]);
    }
    Ok(())
}

fn restore_backups(targets: &[PathBuf; 3], backups: &[PathBuf], indices: &[usize]) {
    for index in indices.iter().rev() {
        let _ = fs::rename(&backups[*index], &targets[*index]);
    }
}

fn remove_path(path: &Path) {
    if path.is_dir() {
        let _ = fs::remove_dir_all(path);
    } else {
        let _ = fs::remove_file(path);
    }
}

fn install_swap_error() -> IntegrationError {
    IntegrationError {
        code: "OPENCODE_INSTALL_FAILED",
        message: "OpenCode 연동 파일을 안전하게 교체하지 못했습니다.",
    }
}

fn invalid_config_error() -> IntegrationError {
    IntegrationError {
        code: "OPENCODE_CONFIG_INVALID",
        message: "OpenCode 전역 설정을 안전하게 해석하지 못했습니다.",
    }
}

fn read_json5(path: &Path) -> Result<Value, IntegrationError> {
    let metadata = fs::metadata(path).map_err(|_| IntegrationError {
        code: "OPENCODE_CONFIG_UNAVAILABLE",
        message: "OpenCode 설정을 읽지 못했습니다.",
    })?;
    if metadata.len() > MAX_CONFIG_BYTES {
        return Err(IntegrationError {
            code: "OPENCODE_CONFIG_INVALID",
            message: "OpenCode 설정 파일이 안전한 처리 한도를 초과합니다.",
        });
    }
    let source = fs::read_to_string(path).map_err(|_| IntegrationError {
        code: "OPENCODE_CONFIG_UNAVAILABLE",
        message: "OpenCode 설정을 읽지 못했습니다.",
    })?;
    json5::from_str(&source).map_err(|_| IntegrationError {
        code: "OPENCODE_CONFIG_INVALID",
        message: "OpenCode 설정 형식이 올바르지 않습니다.",
    })
}
