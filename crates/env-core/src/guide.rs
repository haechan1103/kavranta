use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use base64::{Engine as _, engine::general_purpose::STANDARD};
use tempfile::NamedTempFile;

use crate::manifest::MANAGED_DIR_NAME;
use crate::{EnvError, EnvResult};

const GUIDES_DIR_NAME: &str = "guides";
const ATTACHMENTS_DIR_NAME: &str = "attachments";
pub const MAX_GUIDE_BYTES: usize = 64 * 1024;
pub const MAX_ATTACHMENT_BYTES: usize = 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS: [&str; 6] = ["png", "jpg", "jpeg", "webp", "gif", "svg"];

/// Local image attached to a variable guide, encoded for the desktop UI.
#[derive(Debug, Clone)]
pub struct GuideAttachment {
    pub mime_type: String,
    pub base64: String,
}

/// Value-free, project-local markdown guide for one variable name.
pub fn guide_relative_path(key: &str) -> String {
    format!("{MANAGED_DIR_NAME}/{GUIDES_DIR_NAME}/{key}.md")
}

pub fn read_guide(root: &Path, key: &str) -> EnvResult<Option<String>> {
    validate_key(key)?;
    let path = root.join(guide_relative_path(key));
    if !path.is_file() {
        return Ok(None);
    }
    let bytes = fs::read(&path).map_err(|error| EnvError::io(&path, error))?;
    if bytes.len() > MAX_GUIDE_BYTES {
        return Err(EnvError::invalid("가이드 파일이 허용 크기를 초과했습니다."));
    }
    String::from_utf8(bytes)
        .map(Some)
        .map_err(|_| EnvError::invalid("가이드 파일은 UTF-8 텍스트여야 합니다."))
}

pub fn write_guide(root: &Path, key: &str, markdown: &str) -> EnvResult<String> {
    validate_key(key)?;
    if markdown.trim().is_empty() {
        return Err(EnvError::invalid("빈 가이드는 저장할 수 없습니다."));
    }
    if markdown.len() > MAX_GUIDE_BYTES {
        return Err(EnvError::invalid("가이드가 허용 크기를 초과했습니다."));
    }
    let directory = root.join(MANAGED_DIR_NAME).join(GUIDES_DIR_NAME);
    fs::create_dir_all(&directory).map_err(|error| EnvError::io(&directory, error))?;
    let path = root.join(guide_relative_path(key));
    let mut staged =
        NamedTempFile::new_in(&directory).map_err(|error| EnvError::io(&directory, error))?;
    staged
        .write_all(markdown.as_bytes())
        .map_err(|error| EnvError::io(&path, error))?;
    staged
        .as_file()
        .sync_all()
        .map_err(|error| EnvError::io(&path, error))?;
    staged
        .persist(&path)
        .map_err(|error| EnvError::io(&path, error.error))?;
    Ok(guide_relative_path(key))
}

pub fn remove_guide(root: &Path, key: &str) -> EnvResult<()> {
    validate_key(key)?;
    let path: PathBuf = root.join(guide_relative_path(key));
    if path.exists() {
        fs::remove_file(&path).map_err(|error| EnvError::io(&path, error))?;
    }
    Ok(())
}

pub fn read_guide_attachment(
    root: &Path,
    key: &str,
    file: &str,
) -> EnvResult<Option<GuideAttachment>> {
    validate_key(key)?;
    let file_name = validate_attachment_name(file)?;
    let path = root
        .join(MANAGED_DIR_NAME)
        .join(GUIDES_DIR_NAME)
        .join(ATTACHMENTS_DIR_NAME)
        .join(file_name);
    let size = fs::metadata(&path)
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    if !path.is_file() {
        return Ok(None);
    }
    if size > MAX_ATTACHMENT_BYTES as u64 {
        return Err(EnvError::invalid("첨부 이미지가 허용 크기를 초과했습니다."));
    }
    let bytes = fs::read(&path).map_err(|error| EnvError::io(&path, error))?;
    let extension = file_name
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mime_type = match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => return Err(EnvError::invalid("지원하지 않는 이미지 형식입니다.")),
    };
    Ok(Some(GuideAttachment {
        mime_type: mime_type.to_owned(),
        base64: STANDARD.encode(&bytes),
    }))
}

fn validate_attachment_name(file: &str) -> EnvResult<&str> {
    let valid = !file.is_empty()
        && file.len() <= 128
        && file
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'));
    let extension = file
        .rsplit('.')
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let allowed = ALLOWED_ATTACHMENT_EXTENSIONS.contains(&extension.as_str());
    if valid && allowed {
        Ok(file)
    } else {
        Err(EnvError::invalid("첨부 파일명이 올바르지 않습니다."))
    }
}

fn validate_key(key: &str) -> EnvResult<()> {
    let valid = !key.is_empty()
        && key.len() <= 256
        && key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'));
    if valid {
        Ok(())
    } else {
        Err(EnvError::invalid("가이드 키가 올바르지 않습니다."))
    }
}
