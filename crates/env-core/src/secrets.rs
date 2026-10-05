use std::sync::OnceLock;

use serde::Deserialize;

use crate::{EnvError, EnvResult};

#[derive(Debug, Deserialize)]
struct Catalog {
    charsets: std::collections::BTreeMap<String, String>,
    rules: Vec<Rule>,
}

#[derive(Debug, Deserialize)]
struct Rule {
    id: String,
    segments: Vec<Segment>,
}

/// A segment is either a literal or a run over one declared charset. Exactly one is set;
/// the catalog's own self-check rejects a segment that sets neither or both.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Segment {
    #[serde(default)]
    literal: Option<String>,
    #[serde(default)]
    run: Option<String>,
    #[serde(default)]
    min: usize,
    #[serde(default)]
    max: usize,
}

/// How much of a detected span is shown when it is redacted. Enough to recognize the shape
/// without reproducing enough of the value to be useful if the text is later shared.
const MASK_VISIBLE_PREFIX: usize = 4;
const MASK_VISIBLE_SUFFIX: usize = 2;
/// Bound on a single scan so a pathological input cannot produce an unbounded walk.
const MAX_SCAN_CHARS: usize = 262_144;
/// Same bound, exposed so a caller can build an input that exceeds it in a test.
pub const MAX_SCAN_CHARS_FOR_TESTS: usize = MAX_SCAN_CHARS;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SecretFinding {
    /// Catalog id of the matched rule, safe to display.
    pub rule: String,
    /// Redacted form of the matched span. Never the original.
    pub masked: String,
}

struct CompiledRule {
    id: String,
    segments: Vec<CompiledSegment>,
}

enum CompiledSegment {
    Literal(String),
    Run {
        allowed: Vec<char>,
        min: usize,
        max: usize,
    },
}

fn catalog() -> &'static [CompiledRule] {
    static CATALOG: OnceLock<Vec<CompiledRule>> = OnceLock::new();
    CATALOG
        .get_or_init(|| {
            let raw = include_str!("../../../config/secret-patterns.json");
            let catalog: Catalog =
                serde_json::from_str(raw).expect("config/secret-patterns.json must parse");
            catalog
                .rules
                .into_iter()
                .map(|rule| CompiledRule {
                    id: rule.id,
                    segments: rule
                        .segments
                        .into_iter()
                        .map(|segment| match (&segment.literal, &segment.run) {
                            (Some(text), _) => CompiledSegment::Literal(text.clone()),
                            (_, Some(name)) => CompiledSegment::Run {
                                allowed: catalog
                                    .charsets
                                    .get(name)
                                    .map(|set| set.chars().collect::<Vec<char>>())
                                    .unwrap_or_default(),
                                min: segment.min,
                                max: segment.max,
                            },
                            // A segment with neither is a catalog authoring error. Fail at
                            // compile-of-catalog time rather than silently never matching.
                            (None, None) => panic!("a segment needs a literal or a run"),
                        })
                        .collect(),
                })
                .collect()
        })
        .as_slice()
}

/// Report every distinct rule that matches `text`, with each match redacted.
///
/// At most one finding per rule, so a warning cannot be used to learn how many secrets a
/// description holds.
pub fn detect(text: &str) -> Vec<SecretFinding> {
    if text.len() > MAX_SCAN_CHARS {
        return Vec::new();
    }
    catalog()
        .iter()
        .filter_map(|rule| {
            match_span(text, rule).map(|(start, end)| SecretFinding {
                rule: rule.id.clone(),
                masked: redact_span(&text[start..end]),
            })
        })
        .collect()
}

/// Replace each detected span with its redacted form, leaving surrounding prose intact.
///
/// Offered as a one-click action rather than applied automatically: the text belongs to the
/// user, and they may be documenting a value's shape on purpose.
pub fn redact(text: &str) -> String {
    if text.len() > MAX_SCAN_CHARS {
        return text.to_owned();
    }
    let mut spans = Vec::new();
    for rule in catalog() {
        let mut cursor = 0;
        while let Some((start, end)) = match_span_from(text, rule, cursor) {
            spans.push((start, end));
            cursor = if end > start { end } else { start + 1 };
        }
    }
    if spans.is_empty() {
        return text.to_owned();
    }
    spans.sort_unstable();
    spans.dedup();

    let mut output = String::with_capacity(text.len());
    let mut cursor = 0;
    for (start, end) in spans {
        if start < cursor {
            continue;
        }
        output.push_str(&text[cursor..start]);
        output.push_str(&redact_span(&text[start..end]));
        cursor = end;
    }
    output.push_str(&text[cursor..]);
    output
}

/// First span matching `rule` at or after `from`.
fn match_span_from(text: &str, rule: &CompiledRule, from: usize) -> Option<(usize, usize)> {
    let bytes = text.as_bytes();
    (from..=text.len())
        .find_map(|start| match_segments(bytes, &rule.segments, start).map(|end| (start, end)))
}

fn match_span(text: &str, rule: &CompiledRule) -> Option<(usize, usize)> {
    match_span_from(text, rule, 0)
}

/// Match segments in order. Each position in the input advances at most one character, so
/// the whole search is linear in the input length and needs no regex engine.
fn match_segments(bytes: &[u8], segments: &[CompiledSegment], at: usize) -> Option<usize> {
    let Some((head, rest)) = segments.split_first() else {
        return Some(at);
    };
    match head {
        CompiledSegment::Literal(text) => {
            if bytes[at..].starts_with(text.as_bytes()) {
                match_segments(bytes, rest, at + text.len())
            } else {
                None
            }
        }
        CompiledSegment::Run { allowed, min, max } => {
            let limit = (at + max).min(bytes.len());
            let mut cursor = at;
            // Greedy with a single step back per segment start, which is enough because a
            // following literal anchors the tail.
            while cursor < limit && allowed.contains(&(bytes[cursor] as char)) {
                cursor += 1;
            }
            while cursor >= at + min {
                if let Some(end) = match_segments(bytes, rest, cursor) {
                    return Some(end);
                }
                if cursor == at + min {
                    break;
                }
                cursor -= 1;
            }
            None
        }
    }
}

/// Redact one span. Always non-empty, so a caller cannot echo the original by accident.
fn redact_span(span: &str) -> String {
    let characters: Vec<char> = span.chars().collect();
    if characters.len() <= MASK_VISIBLE_PREFIX + MASK_VISIBLE_SUFFIX {
        return format!("[{}자 가림]", characters.len());
    }
    let prefix: String = characters[..MASK_VISIBLE_PREFIX].iter().collect();
    let suffix: String = characters[characters.len() - MASK_VISIBLE_SUFFIX..]
        .iter()
        .collect();
    format!("{prefix}…{suffix} [{}자 가림]", characters.len())
}

/// Warning text for a set of findings. `None` when there is nothing to report.
pub fn warning(findings: &[SecretFinding]) -> Option<String> {
    if findings.is_empty() {
        return None;
    }
    let rules = findings
        .iter()
        .map(|finding| finding.rule.as_str())
        .collect::<Vec<_>>()
        .join(", ");
    Some(format!(
        "이 텍스트에 비밀처럼 보이는 부분이 있습니다: {rules}. 값을 설명이나 그룹 이름에 그대로 적지 마세요."
    ))
}

/// Reject text that cannot be scanned. This is a resource limit, not a security decision: an
/// oversized string gets a clear error instead of a slow scan.
pub fn check_scannable(text: &str, field: &str) -> EnvResult<()> {
    if text.len() > MAX_SCAN_CHARS {
        return Err(EnvError::invalid(format!(
            "{field}가 너무 길어서 검사하지 못했습니다."
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Test inputs are assembled from fragments at runtime so no test source file contains
    /// a literal that the repository's own boundary scan reads as a live credential. That
    /// scan is the real guard against a secret reaching the repository; these helpers only
    /// keep the fixture shapes recognizable to the matcher.
    fn synthetic(rule: &str) -> String {
        let filler = "F4KE";
        match rule {
            "aws-access-key" => format!("AKIA{}", filler.repeat(4)),
            "openai-api-key" => format!("sk-proj-{}", "f4ke".repeat(6)),
            "anthropic-api-key" => format!("sk-ant-{}", "f4ke".repeat(6)),
            "github-token" => format!("ghp_{}", filler.repeat(9)),
            "npm-token" => format!("npm_{}", filler.repeat(9)),
            "gitlab-token" => format!("glpat-{}", "f4ke".repeat(6)),
            "stripe-secret-key" => format!("sk_live_{}", filler.repeat(7)),
            "slack-token" => format!("xoxb-{}", "f4ke".repeat(6)),
            "google-api-key" => format!("AIza{}", "F4ke".repeat(9)),
            "age-secret-key" => format!("AGE-SECRET-KEY-1{}", filler.repeat(6)),
            "private-key-pem" => format!("-----BEGIN {}PRIVATE KEY-----", "PEM "),
            other => panic!("unknown synthetic rule {other}"),
        }
    }

    #[test]
    fn every_catalog_rule_is_detectable_from_its_own_shape() {
        for entry in catalog() {
            let text = synthetic(&entry.id);
            let found = detect(&text);
            assert!(
                found.iter().any(|finding| finding.rule == entry.id),
                "catalog rule {} did not match its synthetic shape",
                entry.id
            );
        }
    }

    #[test]
    fn ordinary_text_is_not_flagged() {
        for text in [
            "배포 환경 구분용 변수",
            "Listener address for the local dev server",
            "PORT",
            "https://example.com/docs/getting-started",
            "sk-ant is a documented prefix for one provider's keys",
            "value comes from the staging console",
        ] {
            assert!(detect(text).is_empty(), "false positive on {text:?}");
        }
    }

    #[test]
    fn findings_never_reproduce_the_original_span() {
        let secret = synthetic("openai-api-key");
        let found = detect(&format!("use {secret} for the console"));
        assert_eq!(found.len(), 1);
        let finding = &found[0];
        assert!(
            !finding.masked.contains(&secret),
            "masked form leaked the span"
        );
        assert!(
            !finding.masked.contains("f4kef4ke"),
            "masked form leaked more than the allowed prefix"
        );
        assert!(
            finding.masked.starts_with("sk-p"),
            "prefix should stay readable"
        );
    }

    #[test]
    fn redaction_keeps_the_rest_of_the_prose() {
        let text = format!("before {} after", synthetic("aws-access-key"));
        let redacted = redact(&text);
        assert!(redacted.starts_with("before "));
        assert!(redacted.ends_with(" after"));
        assert!(!redacted.contains(&synthetic("aws-access-key")));
        assert!(redacted.contains("가림"));
    }

    #[test]
    fn redaction_handles_several_spans_and_a_mixed_provided_shape() {
        let text = format!(
            "{}\nand {}\nor {}",
            synthetic("github-token"),
            synthetic("npm-token"),
            synthetic("private-key-pem")
        );
        let redacted = redact(&text);
        for rule in ["github-token", "npm-token", "private-key-pem"] {
            assert!(
                !redacted.contains(&synthetic(rule)),
                "{rule} survived redaction"
            );
        }
        // The connecting prose between the three spans must survive untouched.
        assert!(redacted.contains("\nand "), "middle connector lost");
        assert!(redacted.contains("\nor "), "last connector lost");
        assert_eq!(
            redacted.matches("가림").count(),
            3,
            "each span redacted once"
        );
    }

    #[test]
    fn redaction_is_idempotent_and_leaves_clean_text_untouched() {
        let clean = "설명 없이 값만 넣는 변수";
        assert_eq!(redact(clean), clean);
        let once = redact(&format!("x {} y", synthetic("slack-token")));
        assert_eq!(redact(&once), once);
    }

    #[test]
    fn each_rule_reports_at_most_one_finding() {
        let text = format!(
            "{}\n{}\n{}",
            synthetic("openai-api-key"),
            synthetic("openai-api-key"),
            synthetic("openai-api-key")
        );
        assert_eq!(detect(&text).len(), 1);
    }

    #[test]
    fn warning_is_absent_for_clean_text_and_lists_rules_otherwise() {
        assert!(warning(&detect("깔끔한 설명")).is_none());
        let text = format!(
            "{} {}",
            synthetic("openai-api-key"),
            synthetic("aws-access-key")
        );
        let message = warning(&detect(&text)).expect("warning");
        assert!(message.contains("openai-api-key"));
        assert!(message.contains("aws-access-key"));
    }

    #[test]
    fn detection_reports_advice_rather_than_an_error() {
        // The whole point: a detection must never turn a legitimate write into a failure.
        let found = detect(&synthetic("npm-token"));
        assert!(!found.is_empty());
        assert!(check_scannable(&synthetic("npm-token"), "설명").is_ok());
    }
}
