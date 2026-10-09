use super::*;
use std::process::Command;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct OpenExternalRequest {
    url: String,
}

/// Open one http(s) URL in the user's default browser.
///
/// The scheme allowlist is the security boundary: without it, `open`/`start`/`xdg-open`
/// will happily handle `file://` and app-scheme URLs, which turns a link rendered from
/// guide text into a way to launch a local app or reveal a local path.
///
/// Failure is reported rather than swallowed. A previous version spawned the opener and
/// discarded the result, so a link that did not open produced no error anywhere and the
/// user could only conclude that clicking does nothing.
#[tauri::command]
pub fn open_external(request: OpenExternalRequest) -> CommandResult<()> {
    let url = request.url.trim();
    if url.is_empty() || url.chars().count() > MAX_EXTERNAL_URL_CHARS {
        return Err(CommandError {
            code: "UNSUPPORTED_URL".to_owned(),
            message: "링크가 비어 있거나 너무 깁니다.".to_owned(),
        });
    }
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err(CommandError {
            code: "UNSUPPORTED_URL".to_owned(),
            message: "http(s) 링크만 열 수 있습니다.".to_owned(),
        });
    }
    open_url(url).map_err(|error| CommandError {
        code: "OPEN_FAILED".to_owned(),
        message: format!("링크를 열지 못했습니다: {error}"),
    })
}

const MAX_EXTERNAL_URL_CHARS: usize = 2048;

/// Launch the platform opener and wait for it to exit so a failure can be reported.
///
/// The opener returns as soon as it has handed the URL to the desktop, so waiting on it
/// does not wait for the browser. Waiting is what makes a broken opener visible.
fn open_url(url: &str) -> std::io::Result<()> {
    let status = opener_command(url).status()?;
    if status.success() {
        Ok(())
    } else {
        Err(std::io::Error::other(format!(
            "opener exited with status {status}"
        )))
    }
}

#[cfg(target_os = "macos")]
fn opener_command(url: &str) -> Command {
    let mut command = Command::new("open");
    command.arg(url);
    command
}

#[cfg(target_os = "windows")]
fn opener_command(url: &str) -> Command {
    let mut command = Command::new("cmd");
    // The empty argument after `start` is the window title, which `start` would otherwise
    // read from the URL and mis-parse when the URL is quoted.
    command.args(["/C", "start", "", url]);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn opener_command(url: &str) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(url);
    command
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(url: &str) -> OpenExternalRequest {
        OpenExternalRequest {
            url: url.to_owned(),
        }
    }

    #[test]
    fn only_http_schemes_are_forwarded_to_the_opener() {
        // These must be refused before the opener is ever consulted, because the platform
        // opener would act on them.
        for url in [
            "file:///etc/passwd",
            "javascript:alert(1)",
            "vbscript:msgbox(1)",
            "data:text/html,<script>alert(1)</script>",
            "ssh://host",
            "/Applications/Calculator.app",
            "  ftp://example.com/x  ",
            "",
            "   ",
        ] {
            let error = open_external(request(url)).expect_err("must be refused");
            assert_eq!(error.code, "UNSUPPORTED_URL", "wrong code for {url:?}");
        }
    }

    #[test]
    fn an_over_long_url_is_refused_before_reaching_the_opener() {
        let url = format!("https://example.com/{}", "a".repeat(MAX_EXTERNAL_URL_CHARS));
        let error = open_external(request(&url)).expect_err("must be refused");
        assert_eq!(error.code, "UNSUPPORTED_URL");
    }

    // The accepted path launches a real browser, so it is exercised by hand rather than in
    // a unit test. What matters here is that every refusal happens before `open_url`.
}
