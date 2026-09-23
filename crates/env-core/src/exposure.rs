use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExposureSeverity {
    Certain,
    Likely,
    Possible,
}

impl ExposureSeverity {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Certain => "certain",
            Self::Likely => "likely",
            Self::Possible => "possible",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExposureDisposition {
    Exposed,
    Allowed,
    Managed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExposureKind {
    EnvFile,
    DevVars,
    CredentialFile,
    Npmrc,
    Pypirc,
    Netrc,
    SshPrivateKey,
    AwsCredentials,
    McpConfig,
    GoogleServices,
    ShellHistory,
    AgentTranscript,
}

impl ExposureKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::EnvFile => "env-file",
            Self::DevVars => "dev-vars",
            Self::CredentialFile => "credential-file",
            Self::Npmrc => "npmrc",
            Self::Pypirc => "pypirc",
            Self::Netrc => "netrc",
            Self::SshPrivateKey => "ssh-private-key",
            Self::AwsCredentials => "aws-credentials",
            Self::McpConfig => "mcp-config",
            Self::GoogleServices => "google-services",
            Self::ShellHistory => "shell-history",
            Self::AgentTranscript => "agent-transcript",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposureFinding {
    pub path: String,
    pub kind: ExposureKind,
    pub severity: ExposureSeverity,
    pub disposition: ExposureDisposition,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

impl ExposureFinding {
    pub fn id(&self) -> String {
        format!("{}:{}", self.kind.as_str(), self.path)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ExposureState {
    Scanned,
    Unavailable,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposureCounts {
    pub certain: usize,
    pub likely: usize,
    pub possible: usize,
    pub allowed: usize,
    pub managed: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExposureProjection {
    pub state: ExposureState,
    pub deep: bool,
    pub counts: ExposureCounts,
    pub findings: Vec<ExposureFinding>,
}

impl ExposureProjection {
    pub fn unavailable(deep: bool) -> Self {
        Self {
            state: ExposureState::Unavailable,
            deep,
            counts: ExposureCounts::default(),
            findings: Vec::new(),
        }
    }

    pub fn from_findings(deep: bool, findings: Vec<ExposureFinding>) -> Self {
        let mut counts = ExposureCounts::default();
        for finding in &findings {
            match finding.disposition {
                ExposureDisposition::Allowed => counts.allowed += 1,
                ExposureDisposition::Managed => counts.managed += 1,
                ExposureDisposition::Exposed => match finding.severity {
                    ExposureSeverity::Certain => counts.certain += 1,
                    ExposureSeverity::Likely => counts.likely += 1,
                    ExposureSeverity::Possible => counts.possible += 1,
                },
            }
        }
        Self {
            state: ExposureState::Scanned,
            deep,
            counts,
            findings,
        }
    }
}
