//! Non-blocking advice when descriptive text looks like it contains a value.
//!
//! A realistic leak needs no adversary: someone pastes a real value into a variable
//! description, a group name, or guide prose, and it is then stored in
//! `.env-manager.json`, rendered in the UI, and eligible for a commit.
//!
//! The advice lands in the plan summary because that is the one string the user already
//! reads before approving a mutation, so it is the cheapest place to catch the mistake.
//!
//! Two properties are deliberate:
//!
//! - **It never blocks.** `secret_warning` only appends text to a summary. Nothing here can
//!   turn a legitimate write into a failure, because the catalog is pattern-based and will
//!   eventually match something valid. A false positive must cost a sentence, not a write.
//! - **It never reads a value.** Detection is pattern matching over text the user already
//!   typed. No env file is opened and no protected value is loaded.

use env_core::secrets;

/// Append a warning to `summary` when any of `fields` looks like it contains a value.
///
/// Returns the summary unchanged when there is nothing to report.
pub(super) fn secret_warning(summary: &str, fields: &[(&str, &str)]) -> String {
    let mut rules = Vec::new();
    for (field, text) in fields {
        // A field that cannot be scanned is left alone rather than turned into an error:
        // reporting is advisory, and the write path has its own length rules.
        if env_core::check_scannable(text, field).is_err() {
            continue;
        }
        for finding in secrets::detect(text) {
            if !rules.iter().any(|existing| existing == &finding.rule) {
                rules.push(finding.rule);
            }
        }
    }
    if rules.is_empty() {
        return summary.to_owned();
    }
    format!(
        "{summary} ⚠ 값처럼 보이는 문자열이 있습니다({}). 설명란에는 넣지 마세요.",
        rules.join(", ")
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Assembled from fragments so this file never contains a literal that the repository
    /// boundary scan reads as a live credential.
    fn synthetic(rule: &str) -> String {
        match rule {
            "openai-api-key" => format!("sk-proj-{}", "f4ke".repeat(6)),
            "aws-access-key" => format!("AKIA{}", "F4KE".repeat(4)),
            other => panic!("unknown synthetic rule {other}"),
        }
    }

    #[test]
    fn clean_text_leaves_the_summary_untouched() {
        let summary = "GPT_API_KEY 변수 설명을 변경합니다.";
        assert_eq!(
            secret_warning(summary, &[("설명", "OpenAI 콘솔에서 발급")]),
            summary
        );
    }

    #[test]
    fn a_value_shaped_field_appends_advice_without_failing() {
        let pasted = synthetic("openai-api-key");
        let summary = secret_warning(
            "GPT_API_KEY 변수 설명을 변경합니다.",
            &[("설명", pasted.as_str())],
        );
        assert!(summary.starts_with("GPT_API_KEY 변수 설명을 변경합니다."));
        assert!(summary.contains("openai-api-key"));
    }

    #[test]
    fn a_rule_is_reported_once_even_when_several_fields_match() {
        let summary = secret_warning(
            "구조를 변경합니다.",
            &[
                ("설명", synthetic("openai-api-key").as_str()),
                ("그룹명", "prod group"),
            ],
        );
        assert_eq!(summary.matches("openai-api-key").count(), 1);
    }

    #[test]
    fn two_distinct_rules_are_both_named() {
        let summary = secret_warning(
            "구조를 변경합니다.",
            &[
                ("설명", synthetic("openai-api-key").as_str()),
                ("그룹명", synthetic("aws-access-key").as_str()),
            ],
        );
        assert!(summary.contains("openai-api-key"));
        assert!(summary.contains("aws-access-key"));
    }

    #[test]
    fn an_unscannable_field_is_skipped_rather_than_turned_into_an_error() {
        let huge = "a".repeat(env_core::secrets::MAX_SCAN_CHARS_FOR_TESTS + 1);
        let summary = "구조를 변경합니다.";
        assert_eq!(secret_warning(summary, &[("설명", &huge)]), summary);
    }
}
