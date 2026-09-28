use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use walkdir::WalkDir;

use super::*;
use crate::discovery::to_manifest_path;
use crate::exposure::{
    ExposureDisposition, ExposureFinding, ExposureKind, ExposureProjection, ExposureSeverity,
};

const MAX_EXPOSURE_ENTRIES: usize = 20_000;
const DEFAULT_EXCLUDED_DIRECTORIES: &[&str] = &[
    "node_modules",
    ".git",
    ".venv",
    "venv",
    "target",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "coverage",
    ".turbo",
    ".cache",
    "__pycache__",
];

const SHELL_HISTORY_NAMES: &[&str] = &[
    ".zsh_history",
    ".bash_history",
    ".sh_history",
    ".history",
    ".zhistory",
];

const GLOBAL_MCP_PATHS: &[&str] = &[
    ".claude.json",
    ".cursor/mcp.json",
    ".config/opencode/opencode.json",
    ".codex/config.toml",
];

// Agent session transcript directories are deliberately not scanned. A coding agent
// reads its own transcript as part of normal work, and Kavranta is the tool the agent
// is already using, so reporting that directory is expected behavior rather than a
// finding the user can act on. Listing every transcript file also buried the
// actionable deep findings (shell history and global MCP configuration) under
// hundreds of identical rows. See ADR-0035.

impl ProjectService {
    /// Value-free exposure scan: reports names, paths, and counts only.
    pub fn exposure_scan(&self, deep: bool) -> EnvResult<ExposureProjection> {
        let manifest = ManifestStore::for_root(&self.root).load()?;
        self.exposure_scan_with_manifest(&manifest, deep)
    }

    pub(crate) fn exposure_scan_with_manifest(
        &self,
        manifest: &Manifest,
        deep: bool,
    ) -> EnvResult<ExposureProjection> {
        let started = std::time::Instant::now();
        let mut findings = Vec::new();
        let mut seen = BTreeSet::new();
        let managed = self.discover(manifest)?;
        let mut files_scanned = managed.len();
        let managed_paths = managed
            .iter()
            .map(|relative| to_manifest_path(relative))
            .collect::<BTreeSet<_>>();

        for relative in &managed {
            let path = to_manifest_path(relative);
            seen.insert(path.clone());
            let ai_allowed = self.managed_variables_are_ai_allowed(manifest, relative)?;
            findings.push(ExposureFinding {
                kind: managed_kind(&path),
                path,
                severity: ExposureSeverity::Certain,
                disposition: if ai_allowed {
                    ExposureDisposition::Allowed
                } else {
                    ExposureDisposition::Managed
                },
                reason: ai_allowed.then(|| "ai-allowed-variable".to_owned()),
            });
        }

        for entry in WalkDir::new(&self.root)
            .follow_links(false)
            .max_depth(24)
            .into_iter()
            .filter_entry(|entry| !is_excluded_directory(entry.path(), &self.root))
            .flatten()
        {
            if findings.len() >= MAX_EXPOSURE_ENTRIES {
                break;
            }
            if !entry.file_type().is_file() {
                continue;
            }
            files_scanned += 1;
            let relative = entry
                .path()
                .strip_prefix(&self.root)
                .map_or_else(|_| entry.path().to_path_buf(), Path::to_path_buf);
            let path = to_manifest_path(&relative);
            if managed_paths.contains(&path) || !seen.insert(path.clone()) {
                continue;
            }
            let Some((kind, severity)) = classify_secret_file(&path) else {
                continue;
            };
            findings.push(finding(path, kind, severity, manifest));
        }

        if deep && let Some(home) = home_directory() {
            collect_deep_findings(
                &home,
                manifest,
                &mut findings,
                &mut seen,
                &mut files_scanned,
            );
        }

        findings.sort_by_key(|left| left.id());
        let mut projection = ExposureProjection::from_findings(deep, findings);
        projection.files_scanned = files_scanned;
        projection.duration_ms = started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64;
        Ok(projection)
    }

    fn managed_variables_are_ai_allowed(
        &self,
        manifest: &Manifest,
        relative: &Path,
    ) -> EnvResult<bool> {
        let loaded = self.load_document(relative)?;
        Ok(loaded
            .document
            .assignments()
            .iter()
            .any(|assignment| manifest.access_for(assignment.key) == CodexAccess::ReadWrite))
    }
}

fn is_excluded_directory(path: &Path, root: &Path) -> bool {
    if path == root {
        return false;
    }
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| DEFAULT_EXCLUDED_DIRECTORIES.contains(&name))
}

fn managed_kind(path: &str) -> ExposureKind {
    if Path::new(path)
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with(".dev.vars"))
    {
        ExposureKind::DevVars
    } else {
        ExposureKind::EnvFile
    }
}

fn finding(
    path: String,
    kind: ExposureKind,
    severity: ExposureSeverity,
    manifest: &Manifest,
) -> ExposureFinding {
    let candidate = ExposureFinding {
        path,
        kind,
        severity,
        disposition: ExposureDisposition::Exposed,
        reason: None,
    };
    let id = candidate.id();
    if is_allowed_path(&candidate.path, manifest) {
        return ExposureFinding {
            disposition: ExposureDisposition::Allowed,
            reason: Some("user-allowed-path".to_owned()),
            ..candidate
        };
    }
    if manifest
        .exposure
        .allowed_findings
        .iter()
        .any(|allowed| allowed.id == id)
    {
        return ExposureFinding {
            disposition: ExposureDisposition::Allowed,
            reason: Some("user-allowed".to_owned()),
            ..candidate
        };
    }
    candidate
}

fn is_allowed_path(path: &str, manifest: &Manifest) -> bool {
    manifest.exposure.allowed_paths.iter().any(|allowed| {
        if let Some(prefix) = allowed.strip_suffix('/') {
            path == prefix || path.starts_with(&format!("{prefix}/"))
        } else {
            path == allowed
        }
    })
}

fn classify_secret_file(path: &str) -> Option<(ExposureKind, ExposureSeverity)> {
    let name = Path::new(path).file_name()?.to_str()?;
    let lower = name.to_ascii_lowercase();

    if is_template_env(&lower) {
        return None;
    }
    if is_env_name(&lower) {
        return Some((ExposureKind::EnvFile, ExposureSeverity::Certain));
    }
    if name == ".npmrc" {
        return Some((ExposureKind::Npmrc, ExposureSeverity::Certain));
    }
    if name == ".pypirc" {
        return Some((ExposureKind::Pypirc, ExposureSeverity::Certain));
    }
    if name == ".netrc" {
        return Some((ExposureKind::Netrc, ExposureSeverity::Certain));
    }
    if matches!(
        lower.as_str(),
        "credentials.json" | "service-account.json" | "service_account.json" | "client_secret.json"
    ) {
        return Some((ExposureKind::CredentialFile, ExposureSeverity::Certain));
    }
    if matches!(
        lower.as_str(),
        "google-services.json" | "googleservice-info.plist"
    ) {
        return Some((ExposureKind::GoogleServices, ExposureSeverity::Certain));
    }
    if is_ssh_private_key(&lower) {
        return Some((ExposureKind::SshPrivateKey, ExposureSeverity::Certain));
    }
    if path.ends_with(".aws/credentials") || path.starts_with(".aws/credentials") {
        return Some((ExposureKind::AwsCredentials, ExposureSeverity::Certain));
    }
    if name == ".mcp.json"
        || path.ends_with(".cursor/mcp.json")
        || path.ends_with(".vscode/mcp.json")
    {
        return Some((ExposureKind::McpConfig, ExposureSeverity::Likely));
    }
    None
}

fn is_env_name(lower: &str) -> bool {
    lower == ".env"
        || lower.starts_with(".env.")
        || lower.ends_with(".env")
        || lower.contains(".env.")
        || lower == ".dev.vars"
        || lower.starts_with(".dev.vars.")
}

fn is_template_env(lower: &str) -> bool {
    const MARKERS: &[&str] = &["example", "sample", "template", "dist", "defaults"];
    MARKERS.iter().any(|marker| lower.contains(marker))
}

fn is_ssh_private_key(lower: &str) -> bool {
    matches!(
        lower,
        "id_rsa" | "id_ed25519" | "id_ecdsa" | "id_dsa" | "identity"
    ) || lower.ends_with(".pem")
        || lower.ends_with(".key")
        || lower.ends_with(".p12")
        || lower.ends_with(".pfx")
}

fn collect_deep_findings(
    home: &Path,
    manifest: &Manifest,
    findings: &mut Vec<ExposureFinding>,
    seen: &mut BTreeSet<String>,
    scanned: &mut usize,
) {
    for name in SHELL_HISTORY_NAMES {
        let candidate = home.join(name);
        if candidate.is_file() {
            *scanned += 1;
            push_deep(
                findings,
                seen,
                manifest,
                format!("~/{name}"),
                ExposureKind::ShellHistory,
            );
        }
    }
    for relative in GLOBAL_MCP_PATHS {
        if home.join(relative).is_file() {
            *scanned += 1;
            push_deep(
                findings,
                seen,
                manifest,
                format!("~/{relative}"),
                ExposureKind::McpConfig,
            );
        }
    }
}

fn push_deep(
    findings: &mut Vec<ExposureFinding>,
    seen: &mut BTreeSet<String>,
    manifest: &Manifest,
    path: String,
    kind: ExposureKind,
) {
    if !seen.insert(path.clone()) {
        return;
    }
    findings.push(finding(path, kind, ExposureSeverity::Likely, manifest));
}

fn home_directory() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
}

#[cfg(test)]
mod deep_scan_tests {
    use super::*;

    /// ADR-0035: agent session transcripts are not scanned, because an agent reading its
    /// own transcript is expected behavior rather than a finding the user can act on.
    /// Shell history and global MCP config stay scanned, since those are user-authored
    /// credential surfaces. This guards both halves of that decision.
    #[test]
    fn deep_scan_skips_agent_transcripts_but_keeps_credential_surfaces() {
        let home = tempfile::tempdir().expect("temporary home");
        std::fs::write(home.path().join(".zsh_history"), "export FAKE=fake_1\n").expect("history");
        std::fs::create_dir_all(home.path().join(".codex")).expect("codex directory");
        std::fs::write(home.path().join(".codex/config.toml"), "").expect("mcp config");

        for relative in [
            ".codex/sessions",
            ".codex/archived_sessions",
            ".claude/projects",
            ".copilot/session-state",
        ] {
            let directory = home.path().join(relative).join("2026/09/27");
            std::fs::create_dir_all(&directory).expect("transcript directory");
            std::fs::write(
                directory.join("rollout-fake.jsonl"),
                "{\"fake\":\"fake_1\"}\n",
            )
            .expect("transcript");
        }

        let manifest = Manifest::default();
        let mut findings = Vec::new();
        let mut seen = BTreeSet::new();
        let mut scanned = 0;
        collect_deep_findings(
            home.path(),
            &manifest,
            &mut findings,
            &mut seen,
            &mut scanned,
        );

        let paths = findings
            .iter()
            .map(|finding| finding.path.as_str())
            .collect::<Vec<_>>();

        assert!(
            paths.contains(&"~/.zsh_history"),
            "shell history stays scanned"
        );
        assert!(
            paths.contains(&"~/.codex/config.toml"),
            "MCP config stays scanned"
        );
        assert!(
            !paths
                .iter()
                .any(|path| path.contains("sessions") || path.contains("projects")),
            "agent session transcripts must not be reported, got {paths:?}"
        );
        assert_eq!(
            findings.len(),
            2,
            "only the two credential surfaces are reported"
        );
        assert!(
            !serde_json::to_string(&findings)
                .expect("serialized findings")
                .contains("fake_1"),
            "deep findings stay value-free"
        );
    }
}
