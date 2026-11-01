use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::process::Command;

use directories::BaseDirs;
use semver::Version;

use super::model::AgentIntegrationId;

pub(super) fn integration_executable(id: AgentIntegrationId) -> Option<PathBuf> {
    executable_candidates(id).into_iter().find(|executable| {
        agent_command(executable, &[OsString::from("--version")])
            .output()
            .is_ok_and(|output| output.status.success())
    })
}

fn executable_candidates(id: AgentIntegrationId) -> Vec<PathBuf> {
    let name = match id {
        AgentIntegrationId::Codex => "codex",
        AgentIntegrationId::ClaudeCode => "claude",
        AgentIntegrationId::GithubCopilot => "copilot",
        AgentIntegrationId::Cursor => "cursor",
        AgentIntegrationId::OpenCode => "opencode",
    };
    let mut candidates = executable_candidates_named(name);
    if cfg!(target_os = "macos") && id == AgentIntegrationId::Codex {
        candidates.push(PathBuf::from(
            "/Applications/Codex.app/Contents/Resources/codex",
        ));
    }
    if cfg!(target_os = "macos")
        && id == AgentIntegrationId::ClaudeCode
        && let Some(base) = BaseDirs::new()
    {
        candidates.extend(claude_desktop_bundled_candidates(base.data_dir()));
    }
    deduplicate_paths(candidates)
}

/// Claude desktop runs its Code tab on a private Claude Code copy stored under
/// `Claude/claude-code/<version>/<build>/`. It shares `~/.claude` with the CLI, so a
/// plugin installed through it reaches desktop sessions without a separate CLI. The
/// layout is observed rather than documented: it stays a fallback after every CLI
/// location, and the newest semantic version is tried first.
pub(super) fn claude_desktop_bundled_candidates(app_support: &Path) -> Vec<PathBuf> {
    let mut versioned = child_directories(&app_support.join("Claude/claude-code"))
        .into_iter()
        .filter_map(|directory| {
            let name = directory.file_name()?.to_str()?;
            let version = Version::parse(name).ok()?;
            Some((version, directory))
        })
        .flat_map(|(version, directory)| {
            child_directories(&directory).into_iter().map(move |build| {
                (
                    version.clone(),
                    build.join("claude.app/Contents/MacOS/claude"),
                )
            })
        })
        .filter(|(_, executable)| executable.is_file())
        .collect::<Vec<_>>();
    versioned.sort_by(|left, right| right.0.cmp(&left.0));
    versioned
        .into_iter()
        .map(|(_, executable)| executable)
        .collect()
}

fn child_directories(directory: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return Vec::new();
    };
    entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect()
}

pub(super) fn detect_vscode() -> bool {
    if find_executable("code").is_some() {
        return true;
    }
    if cfg!(target_os = "macos") {
        return [
            "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
            "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
        ]
        .iter()
        .any(|path| Path::new(path).is_file());
    }
    if cfg!(windows)
        && let Some(base) = BaseDirs::new()
    {
        return [
            base.data_local_dir()
                .join("Programs/Microsoft VS Code/bin/code.cmd"),
            base.data_local_dir()
                .join("Programs/Microsoft VS Code Insiders/bin/code-insiders.cmd"),
        ]
        .iter()
        .any(|path| path.is_file());
    }
    false
}

pub(super) fn detect_cursor() -> bool {
    if find_executable("cursor").is_some() {
        return true;
    }
    let mut candidates = Vec::new();
    if cfg!(target_os = "macos") {
        candidates.push(PathBuf::from("/Applications/Cursor.app"));
    }
    if let Some(base) = BaseDirs::new() {
        candidates.extend(cursor_user_app_candidates(
            base.home_dir(),
            base.data_local_dir(),
            cfg!(target_os = "macos"),
            cfg!(windows),
        ));
    }
    candidates
        .iter()
        .any(|path| path.is_file() || path.is_dir())
}

pub(super) fn cursor_user_app_candidates(
    home: &Path,
    data_local: &Path,
    macos: bool,
    windows: bool,
) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if macos {
        candidates.push(home.join("Applications/Cursor.app"));
    }
    if windows {
        candidates.extend([
            data_local.join("Programs/Cursor/Cursor.exe"),
            data_local.join("Cursor/Cursor.exe"),
        ]);
    }
    candidates
}

pub(super) fn find_executable(name: &str) -> Option<PathBuf> {
    executable_candidates_named(name).into_iter().next()
}

fn executable_candidates_named(name: &str) -> Vec<PathBuf> {
    let file_names = executable_file_names(name, cfg!(windows));
    let mut candidates = std::env::var_os("PATH")
        .into_iter()
        .flat_map(|paths| std::env::split_paths(&paths).collect::<Vec<_>>())
        .flat_map(|directory| {
            file_names
                .iter()
                .map(move |file_name| directory.join(file_name))
        })
        .filter(|candidate| candidate.is_file())
        .collect::<Vec<_>>();

    if let Some(base) = BaseDirs::new() {
        for directory in home_cli_directories(base.home_dir()) {
            append_named_candidates(&mut candidates, &directory, &file_names);
        }
        if cfg!(windows) {
            for directory in [
                base.data_dir().join("npm"),
                base.data_local_dir().join("pnpm"),
            ] {
                append_named_candidates(&mut candidates, &directory, &file_names);
            }
        }
    }
    if cfg!(target_os = "macos") {
        for directory in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"] {
            append_named_candidates(&mut candidates, Path::new(directory), &file_names);
        }
    }
    deduplicate_paths(candidates)
}

pub(super) fn home_cli_directories(home: &Path) -> Vec<PathBuf> {
    vec![
        home.join(".local/bin"),
        home.join(".cargo/bin"),
        home.join(".npm-global/bin"),
        home.join(".bun/bin"),
        home.join(".opencode/bin"),
        home.join("Library/pnpm"),
    ]
}

fn append_named_candidates(candidates: &mut Vec<PathBuf>, directory: &Path, names: &[String]) {
    candidates.extend(
        names
            .iter()
            .map(|name| directory.join(name))
            .filter(|candidate| candidate.is_file()),
    );
}

pub(super) fn executable_file_names(name: &str, windows: bool) -> Vec<String> {
    if windows {
        ["exe", "cmd", "bat"]
            .into_iter()
            .map(|extension| format!("{name}.{extension}"))
            .collect()
    } else {
        vec![name.to_owned()]
    }
}

fn deduplicate_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    paths.into_iter().fold(Vec::new(), |mut unique, path| {
        if !unique.contains(&path) {
            unique.push(path);
        }
        unique
    })
}

pub(super) fn run_agent_command(executable: &Path, args: Vec<OsString>) -> bool {
    agent_command(executable, &args)
        .status()
        .is_ok_and(|status| status.success())
}

pub(super) fn agent_command(executable: &Path, args: &[OsString]) -> Command {
    // Rust applies Windows batch-file escaping when the program itself is a
    // `.cmd`/`.bat` path. Catalog paths must remain literal arguments.
    let mut command = background_command(executable);
    command.args(args);
    command
}

pub(super) fn background_command(executable: impl AsRef<OsStr>) -> Command {
    let mut command = Command::new(executable);
    suppress_console_window(&mut command);
    command
}

#[cfg(windows)]
fn suppress_console_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn suppress_console_window(_command: &mut Command) {}
