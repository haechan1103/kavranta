use super::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OpenExternalRequest {
    url: String,
}

#[tauri::command]
pub fn open_external(request: OpenExternalRequest) -> CommandResult<()> {
    let url = request.url.trim();
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err(CommandError {
            code: "UNSUPPORTED_URL".to_owned(),
            message: "http(s) 링크만 열 수 있습니다.".to_owned(),
        });
    }
    open_url(url).map_err(|_| CommandError {
        code: "OPEN_FAILED".to_owned(),
        message: "링크를 열지 못했습니다.".to_owned(),
    })
}

#[cfg(target_os = "macos")]
fn open_url(url: &str) -> std::io::Result<()> {
    std::process::Command::new("open")
        .arg(url)
        .spawn()
        .map(|_| ())
}

#[cfg(target_os = "windows")]
fn open_url(url: &str) -> std::io::Result<()> {
    std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn()
        .map(|_| ())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_url(url: &str) -> std::io::Result<()> {
    std::process::Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map(|_| ())
}
