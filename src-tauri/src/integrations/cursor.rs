use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use directories::BaseDirs;
use serde_json::Value;

use super::catalog::copy_directory;
use super::model::{IntegrationError, KAVRANTA_REPOSITORY, PLUGIN_NAME, agent_bundle_version};

pub(super) fn cursor_local_plugin_root() -> Option<PathBuf> {
    BaseDirs::new().map(|base| {
        base.home_dir()
            .join(".cursor/plugins/local")
            .join(PLUGIN_NAME)
    })
}

pub(super) fn install_cursor_plugin(catalog: &Path) -> Result<(), IntegrationError> {
    let target = cursor_local_plugin_root().ok_or(IntegrationError {
        code: "CURSOR_HOME_UNAVAILABLE",
        message: "Cursor 로컬 플러그인 경로를 확인하지 못했습니다.",
    })?;
    install_cursor_plugin_at(&catalog.join("plugins").join(PLUGIN_NAME), &target)
}

pub(super) fn install_cursor_plugin_at(
    source: &Path,
    target: &Path,
) -> Result<(), IntegrationError> {
    install_cursor_plugin_at_with(source, target, |from, to| fs::rename(from, to))
}

pub(super) fn install_cursor_plugin_at_with(
    source: &Path,
    target: &Path,
    mut rename: impl FnMut(&Path, &Path) -> std::io::Result<()>,
) -> Result<(), IntegrationError> {
    validate_cursor_plugin(source)?;
    let parent = target.parent().ok_or(IntegrationError {
        code: "CURSOR_PLUGIN_PATH_INVALID",
        message: "Cursor 로컬 플러그인 경로가 올바르지 않습니다.",
    })?;
    fs::create_dir_all(parent).map_err(|_| IntegrationError {
        code: "CURSOR_PLUGIN_INSTALL_FAILED",
        message: "Cursor 로컬 플러그인 디렉터리를 만들지 못했습니다.",
    })?;

    if target.exists() {
        validate_cursor_identity(target)?;
    }

    let stage = tempfile::Builder::new()
        .prefix(".kavranta-install-")
        .tempdir_in(parent)
        .map_err(|_| IntegrationError {
            code: "CURSOR_PLUGIN_INSTALL_FAILED",
            message: "Cursor 플러그인 임시 설치 디렉터리를 만들지 못했습니다.",
        })?;
    copy_directory(source, stage.path())?;
    validate_cursor_plugin(stage.path())?;
    let stage_path = stage.path().to_path_buf();

    if !target.exists() {
        return rename(&stage_path, target).map_err(|_| IntegrationError {
            code: "CURSOR_PLUGIN_INSTALL_FAILED",
            message: "Cursor 플러그인 설치를 완료하지 못했습니다.",
        });
    }

    let backup = unique_backup_path(parent);
    rename(target, &backup).map_err(|_| IntegrationError {
        code: "CURSOR_PLUGIN_INSTALL_FAILED",
        message: "기존 Cursor 플러그인을 안전하게 보관하지 못했습니다.",
    })?;
    if rename(&stage_path, target).is_err() {
        if rename(&backup, target).is_err() {
            return Err(IntegrationError {
                code: "CURSOR_PLUGIN_ROLLBACK_FAILED",
                message: "Cursor 플러그인 교체와 이전 연결 복원에 실패했습니다. Kavranta에서 연결 복구를 다시 실행해주세요.",
            });
        }
        return Err(IntegrationError {
            code: "CURSOR_PLUGIN_INSTALL_FAILED",
            message: "Cursor 플러그인 교체에 실패해 이전 연결을 복원했습니다.",
        });
    }

    if validate_cursor_plugin(target).is_err() {
        let _ = fs::remove_dir_all(target);
        if rename(&backup, target).is_err() {
            return Err(IntegrationError {
                code: "CURSOR_PLUGIN_ROLLBACK_FAILED",
                message: "새 Cursor 플러그인 검증과 이전 연결 복원에 실패했습니다. Kavranta에서 연결 복구를 다시 실행해주세요.",
            });
        }
        return Err(IntegrationError {
            code: "CURSOR_PLUGIN_VALIDATION_FAILED",
            message: "새 Cursor 플러그인 검증에 실패해 이전 연결을 복원했습니다.",
        });
    }
    let _ = fs::remove_dir_all(&backup);
    Ok(())
}

fn validate_cursor_plugin(root: &Path) -> Result<(), IntegrationError> {
    validate_cursor_identity(root)?;
    let manifest = read_json(&root.join(".cursor-plugin/plugin.json"))?;
    let hooks = read_json(&root.join("cursor-hooks/hooks.json"))?;
    if manifest["version"].as_str() != Some(agent_bundle_version())
        || manifest["skills"].as_str() != Some("./skills/")
        || manifest["hooks"].as_str() != Some("./cursor-hooks/hooks.json")
        || manifest["mcpServers"].as_str() != Some("./mcp.json")
        || !root.join("skills/kavranta-env/SKILL.md").is_file()
        || !root.join("mcp.json").is_file()
        || !root.join("cursor-hooks/hooks.json").is_file()
        || !cursor_guard_shape_is_valid(&hooks)
    {
        return Err(IntegrationError {
            code: "CURSOR_PLUGIN_INVALID",
            message: "Cursor 플러그인 구성이 올바르지 않습니다.",
        });
    }
    Ok(())
}

fn cursor_guard_shape_is_valid(config: &Value) -> bool {
    let Some(hooks) = config.get("hooks").and_then(Value::as_object) else {
        return false;
    };
    if config.get("version").and_then(Value::as_u64) != Some(1) {
        return false;
    }
    ["preToolUse", "beforeReadFile", "beforeTabFileRead"]
        .into_iter()
        .all(|event| {
            let Some(entries) = hooks.get(event).and_then(Value::as_array) else {
                return false;
            };
            if entries.len() != 1 {
                return false;
            }
            let Some(entry) = entries.first().and_then(Value::as_object) else {
                return false;
            };
            entry
                .get("command")
                .and_then(Value::as_str)
                .is_some_and(|command| {
                    command.contains("kavranta-broker") && command.ends_with(" guard-hook")
                })
                && entry.get("timeout").and_then(Value::as_u64) == Some(5)
                && entry.get("failClosed").and_then(Value::as_bool) == Some(true)
                && (event != "preToolUse"
                    || entry.get("matcher").and_then(Value::as_str)
                        == Some("Shell|Read|Write|Grep|Delete"))
        })
}

fn validate_cursor_identity(root: &Path) -> Result<(), IntegrationError> {
    let manifest = read_json(&root.join(".cursor-plugin/plugin.json"))?;
    if manifest["name"].as_str() != Some(PLUGIN_NAME)
        || manifest["repository"].as_str() != Some(KAVRANTA_REPOSITORY)
    {
        return Err(IntegrationError {
            code: "CURSOR_PLUGIN_CONFLICT",
            message: "같은 위치에 다른 Cursor 플러그인이 있어 덮어쓰지 않았습니다.",
        });
    }
    Ok(())
}

fn read_json(path: &Path) -> Result<Value, IntegrationError> {
    let bytes = fs::read(path).map_err(|_| IntegrationError {
        code: "CURSOR_PLUGIN_INVALID",
        message: "Cursor 플러그인 설정을 읽지 못했습니다.",
    })?;
    serde_json::from_slice(&bytes).map_err(|_| IntegrationError {
        code: "CURSOR_PLUGIN_INVALID",
        message: "Cursor 플러그인 설정 형식이 올바르지 않습니다.",
    })
}

fn unique_backup_path(parent: &Path) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    parent.join(format!(".kavranta-backup-{}-{nonce}", std::process::id()))
}
