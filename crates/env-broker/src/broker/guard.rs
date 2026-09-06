use super::super::*;

pub fn guard_hook_decision(input: &Value) -> Value {
    if hook_requests_direct_env_access(input) {
        if is_cursor_hook(input) {
            return cursor_denied_decision(input);
        }
        return json!({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Direct env-file access is blocked by Kavranta. Use the kavranta MCP tools instead."
            }
        });
    }
    if is_cursor_hook(input) {
        json!({ "permission": "allow" })
    } else {
        json!({})
    }
}

fn cursor_denied_decision(input: &Value) -> Value {
    match input.get("hook_event_name").and_then(Value::as_str) {
        Some("beforeTabFileRead") => json!({ "permission": "deny" }),
        Some("beforeReadFile") => json!({
            "permission": "deny",
            "user_message": "Direct env-file access is blocked by Kavranta. Use the Kavranta tools instead."
        }),
        _ => json!({
            "permission": "deny",
            "user_message": "Direct env-file access is blocked by Kavranta. Use the Kavranta tools instead.",
            "agent_message": "Use the Kavranta MCP tools for redacted env inspection and request-scoped changes."
        }),
    }
}

fn is_cursor_hook(input: &Value) -> bool {
    input.get("cursor_version").is_some()
        || input
            .get("hook_event_name")
            .and_then(Value::as_str)
            .is_some_and(|name| {
                matches!(
                    name,
                    "preToolUse" | "beforeShellExecution" | "beforeReadFile" | "beforeTabFileRead"
                )
            })
}

fn hook_requests_direct_env_access(input: &Value) -> bool {
    let tool_name = input
        .get("tool_name")
        .or_else(|| input.get("toolName"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    // Cursor file-read hooks place `file_path` and attachments at the event root.
    // Inspect only allowlisted path fields so the full `content` payload is ignored.
    if contains_env_path_field(input) {
        return true;
    }

    let command_like = tool_name.contains("bash")
        || tool_name.contains("shell")
        || tool_name.contains("terminal")
        || tool_name.contains("command")
        || tool_name.contains("apply_patch")
        || tool_name == "applypatch";
    let shell_event = input
        .get("hook_event_name")
        .and_then(Value::as_str)
        .is_some_and(|name| name == "beforeShellExecution");
    (command_like || shell_event) && contains_env_command_field(input)
}

fn contains_env_path_field(value: &Value) -> bool {
    match value {
        Value::Object(fields) => fields.iter().any(|(key, value)| {
            let normalized = key.replace(['_', '-'], "").to_ascii_lowercase();
            let path_field = matches!(
                normalized.as_str(),
                "path"
                    | "paths"
                    | "filepath"
                    | "filepaths"
                    | "uri"
                    | "uris"
                    | "glob"
                    | "globpattern"
                    | "include"
                    | "includes"
                    | "exclude"
                    | "excludes"
            );
            (path_field && value_contains_env_reference(value)) || contains_env_path_field(value)
        }),
        Value::Array(values) => values.iter().any(contains_env_path_field),
        _ => false,
    }
}

fn contains_env_command_field(value: &Value) -> bool {
    match value {
        Value::Object(fields) => fields.iter().any(|(key, value)| {
            let normalized = key.replace(['_', '-'], "").to_ascii_lowercase();
            let command_field = matches!(
                normalized.as_str(),
                "command" | "cmd" | "script" | "patch" | "patchtext"
            );
            (command_field && value_contains_env_reference(value))
                || contains_env_command_field(value)
        }),
        Value::Array(values) => values.iter().any(contains_env_command_field),
        _ => false,
    }
}

fn value_contains_env_reference(value: &Value) -> bool {
    match value {
        Value::String(text) => contains_env_reference(text),
        Value::Array(values) => values.iter().any(value_contains_env_reference),
        Value::Object(fields) => fields.values().any(value_contains_env_reference),
        _ => false,
    }
}

fn contains_env_reference(text: &str) -> bool {
    text.split(is_reference_separator)
        .flat_map(|part| part.split(['/', '\\']))
        .map(|part| {
            part.trim_matches(|character: char| {
                matches!(character, '*' | '?' | '!' | '+' | '@' | '$')
            })
        })
        .any(is_env_data_name)
}

fn is_reference_separator(character: char) -> bool {
    character.is_whitespace()
        || matches!(
            character,
            '/' | '\\'
                | '\''
                | '"'
                | '`'
                | '='
                | ':'
                | ';'
                | ','
                | '('
                | ')'
                | '['
                | ']'
                | '{'
                | '}'
                | '<'
                | '>'
                | '|'
                | '&'
        )
}

fn is_env_data_name(candidate: &str) -> bool {
    let normalized = candidate.to_ascii_lowercase();
    if normalized == ".dev.vars" || normalized.starts_with(".dev.vars.") {
        return true;
    }
    normalized.match_indices(".env").any(|(index, _)| {
        let suffix = &normalized[index..];
        suffix == ".env" || suffix.starts_with(".env.")
    })
}
