use super::*;

/// One line of an env file as it appears on disk, with every value withheld
/// (ADR-0044). Comments are returned only when they cannot carry a value.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RedactedSourceLine {
    /// 1-based line where the node starts.
    pub line: usize,
    #[serde(flatten)]
    pub content: RedactedSourceContent,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum RedactedSourceContent {
    Blank,
    Comment {
        text: String,
    },
    /// A comment that looks like `KEY=value` or holds a secret-shaped token. Only the
    /// name, when there is one, is returned.
    WithheldComment {
        key: Option<String>,
    },
    Group {
        name: String,
    },
    Assignment {
        key: String,
        value_state: RedactedValueState,
    },
    /// A line the parser preserved but could not interpret. Its text is never returned.
    Unparsed,
}

impl ProjectService {
    pub fn redacted_source(&self, file: &str) -> EnvResult<Vec<RedactedSourceLine>> {
        let loaded = self.load_managed_document(file)?;
        let document = &loaded.document;
        let source = document.source();
        let mut lines = Vec::with_capacity(document.nodes().len());
        let mut line = 1;
        let mut cursor = 0;
        for (index, node) in document.nodes().iter().enumerate() {
            let start = node.span().start.min(source.len());
            line += source[cursor.min(start)..start]
                .iter()
                .filter(|byte| **byte == b'\n')
                .count();
            cursor = start;
            lines.push(RedactedSourceLine {
                line,
                content: redact_node(document, index, node),
            });
        }
        Ok(lines)
    }
}

fn redact_node(document: &Document, index: usize, node: &Node) -> RedactedSourceContent {
    match node {
        Node::Blank { .. } => RedactedSourceContent::Blank,
        Node::Comment { content, .. } => redact_comment(document.text(*content)),
        Node::GroupDirective { name, .. } => RedactedSourceContent::Group {
            name: document.text(*name).to_owned(),
        },
        Node::Assignment { key, .. } => RedactedSourceContent::Assignment {
            key: document.text(*key).to_owned(),
            value_state: assignment_state(document, index),
        },
        Node::Opaque { .. } => RedactedSourceContent::Unparsed,
    }
}

fn assignment_state(document: &Document, index: usize) -> RedactedValueState {
    let empty = document
        .assignments()
        .iter()
        .find(|assignment| assignment.node_index == index)
        .and_then(|assignment| assignment.decoded_value().ok())
        .map(Zeroizing::new)
        .is_some_and(|value| value.is_empty());
    if empty {
        RedactedValueState::Empty
    } else {
        RedactedValueState::Present
    }
}

fn redact_comment(text: &str) -> RedactedSourceContent {
    if let Some(key) = commented_assignment_key(text) {
        return RedactedSourceContent::WithheldComment { key: Some(key) };
    }
    if !crate::secrets::detect(text).is_empty() {
        return RedactedSourceContent::WithheldComment { key: None };
    }
    RedactedSourceContent::Comment {
        text: text.to_owned(),
    }
}

/// `# export API_KEY=...` or `#API_KEY = ...`: a disabled assignment whose value must stay hidden.
fn commented_assignment_key(text: &str) -> Option<String> {
    let trimmed = text.trim_start();
    let trimmed = trimmed
        .strip_prefix("export ")
        .unwrap_or(trimmed)
        .trim_start();
    let (name, _) = trimmed.split_once('=')?;
    let name = name.trim_end();
    let mut characters = name.chars();
    let first = characters.next()?;
    let valid = (first.is_ascii_alphabetic() || first == '_')
        && characters.all(|character| {
            character.is_ascii_alphanumeric() || character == '_' || character == '.'
        });
    valid.then(|| name.to_owned())
}
