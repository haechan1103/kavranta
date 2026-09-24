use super::*;

/// One runtime redaction assertion over a synthetic canary secret.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProofCheck {
    pub name: String,
    pub passed: bool,
}

/// The result of proving, at runtime, that redacted outputs contain no values.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RedactionProof {
    pub checks: Vec<ProofCheck>,
    pub passed: usize,
    pub total: usize,
    pub duration_ms: u64,
}

/// Runs synthetic canary secrets through the redacted read paths of an isolated
/// temporary project and proves none of the outputs contain them.
///
/// The temporary project lives under the OS temp directory and is removed when
/// this returns. No registry, audit log, or real project is touched, and the
/// canary itself is zeroized. This is the runtime counterpart of the
/// canary-free unit tests: the shipped binary proves its own redaction.
pub fn run_redaction_self_check() -> EnvResult<RedactionProof> {
    let started = std::time::Instant::now();
    let nonce = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |duration| duration.as_nanos());
    let secret: Zeroizing<String> = Zeroizing::new(format!("KAVRANTA_PROOF_SECRET_{nonce}"));
    let key = "KAVRANTA_PROOF_KEY";

    let directory =
        tempfile::tempdir().map_err(|error| EnvError::io(&std::env::temp_dir(), error))?;
    fs::write(
        directory.path().join("proof.env"),
        format!("{key}={}\n", secret.as_str()),
    )
    .map_err(|error| EnvError::io(directory.path(), error))?;
    let service = ProjectService::open(directory.path())?;

    let mut checks = Vec::new();
    let mut prove = |name: &str, output: &str| {
        checks.push(ProofCheck {
            name: name.to_owned(),
            passed: !output.contains(secret.as_str()),
        });
    };

    let projection = service.initialize()?;
    prove(
        "inspect",
        &serde_json::to_string(&projection).map_err(EnvError::serialization)?,
    );
    let exposure = service.exposure_scan(false)?;
    prove(
        "exposure-scan",
        &serde_json::to_string(&exposure).map_err(EnvError::serialization)?,
    );
    let occurrences = service.redacted_occurrences(key)?;
    prove(
        "redacted-occurrences",
        &serde_json::to_string(&occurrences).map_err(EnvError::serialization)?,
    );
    service.save_value(SaveValueRequest {
        file: "proof.env".to_owned(),
        key: key.to_owned(),
        new_value: (*secret).clone(),
    })?;
    let rescanned = service.scan()?;
    prove(
        "inspect-after-write",
        &serde_json::to_string(&rescanned).map_err(EnvError::serialization)?,
    );
    service.save_variable_guide(key, "# Proof guide\n\nNo values live here.")?;
    let guide = service.variable_guide(key)?.unwrap_or_default();
    prove("guide-roundtrip", &guide);

    let passed = checks.iter().filter(|check| check.passed).count();
    Ok(RedactionProof {
        total: checks.len(),
        passed,
        checks,
        duration_ms: started.elapsed().as_millis().min(u128::from(u64::MAX)) as u64,
    })
}
