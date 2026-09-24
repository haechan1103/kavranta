use super::super::*;

#[test]
fn redaction_self_check_proves_canary_free_outputs() {
    let proof = run_redaction_self_check().expect("self check");
    assert_eq!(proof.total, 5);
    assert_eq!(proof.passed, proof.total);
    assert!(proof.checks.iter().all(|check| check.passed));
    let names = proof
        .checks
        .iter()
        .map(|check| check.name.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        names,
        [
            "inspect",
            "exposure-scan",
            "redacted-occurrences",
            "inspect-after-write",
            "guide-roundtrip",
        ]
    );
}
