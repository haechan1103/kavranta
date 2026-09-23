use super::super::*;

pub fn tool_definitions() -> Value {
    json!([
        tool(
            "plan_register_current_project",
            "Plan local registration of the broker's current Git worktree or recognized project workspace. Takes no path, never returns env values, and never changes env files.",
            json!({
                "type": "object", "properties": {}, "additionalProperties": false
            })
        ),
        tool(
            "inspect_project",
            "Return redacted env structure and value presence for a registered project.",
            json!({
                "type": "object", "properties": { "projectPath": { "type": "string" } }, "required": ["projectPath"], "additionalProperties": false
            })
        ),
        tool(
            "find_reusable_variable_sources",
            "Find same-name variables with present values in other registered projects. Returns project and file metadata only, never values.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "key": { "type": "string" }
                }, "required": ["projectPath", "key"], "additionalProperties": false
            })
        ),
        tool(
            "find_registered_projects",
            "Resolve a project name, alias, ID, or path fragment against locally registered projects. Returns bounded available project metadata only, never environment values.",
            json!({
                "type": "object", "properties": {
                    "query": { "type": "string", "minLength": 1, "maxLength": 80 },
                    "limit": { "type": "integer", "minimum": 1, "maximum": 25, "default": 10 }
                }, "required": ["query"], "additionalProperties": false
            })
        ),
        tool(
            "search_registered_variable_sources",
            "Search variable names across registered projects, optionally scoped by stable project ID. Returns bounded key, policy, file, and empty/present metadata only; never values or source lines.",
            json!({
                "type": "object", "properties": {
                    "query": { "type": "string", "minLength": 2, "maxLength": 80 },
                    "projectId": { "type": "string", "minLength": 1, "maxLength": 80 },
                    "includeEmpty": { "type": "boolean", "default": false },
                    "limit": { "type": "integer", "minimum": 1, "maximum": 50, "default": 20 }
                }, "required": ["query"], "additionalProperties": false
            })
        ),
        tool(
            "read_allowed_value",
            "Explicitly read one value only when its policy is read-write.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "file": { "type": "string" }, "key": { "type": "string" }
                }, "required": ["projectPath", "file", "key"], "additionalProperties": false
            })
        ),
        tool(
            "plan_set_allowed_value",
            "Create a redacted plan to replace a read-write value.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "file": { "type": "string" }, "key": { "type": "string" }, "newValue": { "type": "string" }
                }, "required": ["projectPath", "file", "key", "newValue"], "additionalProperties": false
            })
        ),
        tool(
            "plan_stdin_value_write",
            "Create a five-minute, single-use, value-free plan for writing one managed occurrence from the returned trusted Broker executable's stdin. Protected and unclassified values remain unreadable, and linked members are included in the impact.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" },
                    "file": { "type": "string" },
                    "key": { "type": "string" },
                    "trimFinalNewline": { "type": "boolean", "default": false }
                },
                "required": ["projectPath", "file", "key"],
                "additionalProperties": false
            })
        ),
        tool(
            "plan_create_env_file",
            "Plan creating one empty supported env file (.env*, *.env*, or Wrangler .dev.vars*) inside an existing registered-project directory. Existing files and example variants are rejected.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "file": { "type": "string" }
                }, "required": ["projectPath", "file"], "additionalProperties": false
            })
        ),
        tool(
            "plan_add_variable",
            "Plan adding a variable with an empty value. This tool never accepts or returns a value.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "file": { "type": "string" },
                    "key": { "type": "string" }, "group": { "type": "string" },
                    "description": { "type": "array", "items": { "type": "string" } }
                }, "required": ["projectPath", "file", "key", "group"], "additionalProperties": false
            })
        ),
        tool(
            "plan_create_group",
            "Plan adding one explicit # @group marker without reading or changing values.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "file": { "type": "string" }, "name": { "type": "string" }
                }, "required": ["projectPath", "file", "name"], "additionalProperties": false
            })
        ),
        tool(
            "plan_rename_group",
            "Plan renaming one unambiguous explicit group marker.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "file": { "type": "string" },
                    "currentName": { "type": "string" }, "newName": { "type": "string" }
                }, "required": ["projectPath", "file", "currentName", "newName"], "additionalProperties": false
            })
        ),
        tool(
            "plan_move_variable",
            "Plan moving an existing variable and its attached description to an existing group.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "file": { "type": "string" },
                    "key": { "type": "string" }, "targetGroup": { "type": "string" }
                }, "required": ["projectPath", "file", "key", "targetGroup"], "additionalProperties": false
            })
        ),
        tool(
            "plan_update_description",
            "Plan replacing the ordinary comment lines attached to one variable without reading its value.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "file": { "type": "string" },
                    "key": { "type": "string" },
                    "lines": { "type": "array", "items": { "type": "string" } }
                }, "required": ["projectPath", "file", "key", "lines"], "additionalProperties": false
            })
        ),
        tool(
            "plan_link",
            "Plan an N-way peer link without returning any values.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "key": { "type": "string" },
                    "files": { "type": "array", "items": { "type": "string" }, "minItems": 2 },
                    "sourceFile": { "type": ["string", "null"] }
                }, "required": ["projectPath", "key", "files"], "additionalProperties": false
            })
        ),
        tool(
            "plan_detach",
            "Plan detaching one occurrence while preserving its current value.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "linkId": { "type": "string" }, "file": { "type": "string" }
                }, "required": ["projectPath", "linkId", "file"], "additionalProperties": false
            })
        ),
        tool(
            "plan_classification",
            "Plan an explicitly requested Codex access classification without a second confirmation round trip.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "key": { "type": "string" },
                    "access": { "type": "string", "enum": ["read-write", "protected", "unclassified"] }
                }, "required": ["projectPath", "key", "access"], "additionalProperties": false
            })
        ),
        tool(
            "plan_migration",
            "Plan conversion of strong visual group comments to # @group without values.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }, "file": { "type": "string" }
                }, "required": ["projectPath", "file"], "additionalProperties": false
            })
        ),
        tool(
            "plan_copy_variable_from_project",
            "Plan a one-time opaque copy of one same-name value from another registered project. The value is handled only inside Rust and is never returned to the agent.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" },
                    "sourceProjectId": { "type": "string" },
                    "sourceFile": { "type": "string" },
                    "targetFile": { "type": "string" },
                    "key": { "type": "string" }
                },
                "required": ["projectPath", "sourceProjectId", "sourceFile", "targetFile", "key"],
                "additionalProperties": false
            })
        ),
        tool(
            "list_deployment_providers",
            "List official and locally installed providers with availability and version metadata. Never returns values or commands.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }
                }, "required": ["projectPath"], "additionalProperties": false
            })
        ),
        tool(
            "list_action_packs",
            "List locally installed Action Packs, their required secret bindings, target metadata, and CLI compatibility. Never returns values, commands, arguments, or response bodies.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }
                }, "required": ["projectPath"], "additionalProperties": false
            })
        ),
        tool(
            "scan_exposure",
            "Scan a registered project for files an agent could read that may hold secrets, and report names, paths, kinds, and counts only. Findings already allowed by user policy or an AI-allowed variable classification are marked allowed; managed env files are marked managed. Never reads or returns values, and is advisory only.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" },
                    "deep": { "type": "boolean", "default": false, "description": "Also check known home, shell-history, global MCP config, and agent session transcript paths." }
                }, "required": ["projectPath"], "additionalProperties": false
            })
        ),
        tool(
            "plan_set_variable_guide",
            "Plan writing or removing the value-free markdown guide for one managed variable name. The guide explains how to obtain and enter the value and must never contain a value. Omit markdown (or pass an empty string) to remove the guide.",
            json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "key": { "type": "string" },
                    "markdown": { "type": "string", "maxLength": 65536 }
                },
                "required": ["projectPath", "key"],
                "additionalProperties": false
            })
        ),
        tool(
            "request_value_input",
            "Ask the user to type one or more missing secret values in the Kavranta desktop app, then write them into the named env files without the value ever reaching the agent. Returns per-name outcomes only (added/updated/skipped/cancelled/timeout/failed). Use this instead of asking the user to open the app manually. The app is launched automatically when needed.",
            json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "timeoutSeconds": { "type": "integer", "minimum": 30, "maximum": 900 },
                    "entries": {
                        "type": "array",
                        "minItems": 1,
                        "maxItems": 16,
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": { "type": "string" },
                                "file": { "type": "string" },
                                "group": { "type": "string" },
                                "description": { "type": "string" },
                                "classification": { "type": "string", "enum": ["read-write", "protected", "unclassified"] }
                            },
                            "required": ["name", "file"],
                            "additionalProperties": false
                        }
                    }
                },
                "required": ["projectPath", "entries"],
                "additionalProperties": false
            })
        ),
        tool(
            "list_runtime_targets",
            "List registered fixed-verifier Runtime targets for a project. Returns target IDs, display names, source files, and transport labels only; never returns recipients, destinations, remote paths, values, or commands.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }
                }, "required": ["projectPath"], "additionalProperties": false
            })
        ),
        tool(
            "list_team_channels",
            "List connected Folder Team Channels and encrypted-package metadata for a registered project. Never returns folder paths, values, passphrases, or decrypted content. Passphrase publish/import remains a desktop action.",
            json!({
                "type": "object", "properties": {
                    "projectPath": { "type": "string" }
                }, "required": ["projectPath"], "additionalProperties": false
            })
        ),
        tool(
            "compare_deployment_values",
            "Compare selected managed values with a supported deployment target. Returns equality states only; never accepts or returns candidate values, hashes, or provider output.",
            json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "provider": { "type": "string" },
                    "file": { "type": "string" },
                    "keys": {
                        "type": "array", "minItems": 1, "maxItems": 100,
                        "items": { "type": "string" }
                    },
                    "awsProfile": { "type": ["string", "null"] },
                    "awsRegion": { "type": ["string", "null"] },
                    "awsPathPrefix": { "type": ["string", "null"] }
                    ,"runtimeTargetId": { "type": ["string", "null"] }
                },
                "required": ["projectPath", "provider", "file", "keys"],
                "additionalProperties": false
            })
        ),
        tool(
            "verify_android_app_links",
            "Compare one managed Android certificate-fingerprint list with the public App Links statements for explicit hosts. Returns package/host states and counts only; never accepts or returns fingerprints, hashes, response bodies, URLs, or values.",
            json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "file": { "type": "string" },
                    "key": { "type": "string" },
                    "packageName": { "type": "string" },
                    "hosts": {
                        "type": "array", "minItems": 1, "maxItems": 10,
                        "items": { "type": "string" }
                    }
                },
                "required": ["projectPath", "file", "key", "packageName", "hosts"],
                "additionalProperties": false
            })
        ),
        tool(
            "plan_provider_push",
            "Create a redacted one-way provider push plan. Values remain inside Rust and are resolved only when apply_plan is called.",
            json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "provider": { "type": "string" },
                    "file": { "type": "string" },
                    "selections": {
                        "type": "array", "minItems": 1, "maxItems": 100,
                        "items": {
                            "type": "object",
                            "properties": {
                                "key": { "type": "string" },
                                "kind": { "type": "string", "enum": ["secret", "variable", "plaintext", "sensitive"] }
                            },
                            "required": ["key", "kind"],
                            "additionalProperties": false
                        }
                    },
                    "repository": { "type": ["string", "null"] },
                    "githubEnvironment": { "type": ["string", "null"] },
                    "worker": { "type": ["string", "null"] },
                    "cloudflareEnvironment": { "type": ["string", "null"] },
                    "easProject": { "type": ["string", "null"] },
                    "easEnvironments": {
                        "type": "array", "maxItems": 10,
                        "items": { "type": "string" }
                    },
                    "personalTarget": { "type": ["string", "null"] }
                    ,"awsProfile": { "type": ["string", "null"] }
                    ,"awsRegion": { "type": ["string", "null"] }
                    ,"awsPathPrefix": { "type": ["string", "null"] }
                    ,"awsKmsKeyId": { "type": ["string", "null"] }
                },
                "required": ["projectPath", "provider", "file", "selections"],
                "additionalProperties": false
            })
        ),
        tool(
            "plan_install_action_pack",
            "Create a redacted plan to install or explicitly replace one validated local Action Pack from a value-free manifest. The current user request must name the intended fixed CLI or API action.",
            json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "manifest": action_pack_manifest_schema(),
                    "replace": { "type": "boolean", "default": false }
                },
                "required": ["projectPath", "manifest"],
                "additionalProperties": false
            })
        ),
        tool(
            "plan_action",
            "Create a redacted plan for one locally installed Action Pack. Bindings map pack binding IDs to managed variable names. For a protocol 0.2 HTTP pack with an allowlisted body policy, body carries a JSON object whose top-level fields must exactly match that allowlist. Raw values, commands, secret fields, and response bodies are never accepted or returned.",
            json!({
                "type": "object",
                "properties": {
                    "projectPath": { "type": "string" },
                    "packId": { "type": "string" },
                    "file": { "type": "string" },
                    "bindings": {
                        "type": "object",
                        "additionalProperties": { "type": "string" },
                        "minProperties": 1,
                        "maxProperties": 16
                    },
                    "body": { "type": "string", "maxLength": 262144 }
                },
                "required": ["projectPath", "packId", "file", "bindings"],
                "additionalProperties": false
            })
        ),
        tool(
            "apply_plan",
            "Apply one unexpired redacted plan authorized by the current user request.",
            json!({
                "type": "object", "properties": {
                    "planId": { "type": "string" }
                }, "required": ["planId"], "additionalProperties": false
            })
        )
    ])
}

fn tool(name: &str, description: &str, input_schema: Value) -> Value {
    json!({ "name": name, "description": description, "inputSchema": input_schema })
}

fn action_pack_manifest_schema() -> Value {
    let common = json!({
        "schemaVersion": { "type": "integer", "const": 1 },
        "id": { "type": "string" },
        "displayName": { "type": "string" },
        "description": { "type": "string" },
        "packVersion": { "type": "string" },
        "actionProtocolVersion": { "type": "string", "const": "0.1.0" }
    });
    let common = common.as_object().cloned().unwrap_or_default();

    let mut cli = common.clone();
    cli.extend(
        json!({
            "type": { "const": "cli" },
            "executableCandidates": {
                "type": "array", "minItems": 1, "maxItems": 8,
                "items": { "type": "string" }
            },
            "versionArgs": {
                "type": "array", "minItems": 1, "maxItems": 8,
                "items": { "type": "string" }
            },
            "profiles": {
                "type": "array", "minItems": 1, "maxItems": 8,
                "items": {
                    "type": "object",
                    "properties": {
                        "id": { "type": "string" },
                        "versionRequirement": { "type": "string" },
                        "arguments": {
                            "type": "array", "minItems": 1, "maxItems": 32,
                            "items": { "type": "string" }
                        }
                    },
                    "required": ["id", "versionRequirement", "arguments"],
                    "additionalProperties": false
                }
            },
            "secretBinding": { "type": "string" },
            "secretTransport": { "type": "string", "const": "stdin" },
            "resultPolicy": {
                "type": "object",
                "properties": {
                    "success": { "type": "boolean" },
                    "exitCode": { "type": "boolean" },
                    "duration": { "type": "boolean" }
                },
                "additionalProperties": false
            },
            "timeoutSeconds": { "type": "integer", "minimum": 1, "maximum": 120 }
        })
        .as_object()
        .cloned()
        .unwrap_or_default(),
    );

    let mut http = common;
    http.extend(
        json!({
            "type": { "const": "http" },
            "method": { "type": "string", "enum": ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"] },
            "url": { "type": "string" },
            "secretBindings": {
                "type": "object", "minProperties": 1, "maxProperties": 16,
                "additionalProperties": {
                    "type": "object",
                    "properties": {
                        "source": { "type": "string", "const": "header" },
                        "name": { "type": ["string", "null"] },
                        "format": { "type": "string" }
                    },
                    "required": ["source", "format"],
                    "additionalProperties": false
                }
            },
            "resultPolicy": {
                "type": "object",
                "properties": {
                    "status": { "type": "boolean" },
                    "duration": { "type": "boolean" },
                    "body": { "type": "boolean", "const": false },
                    "successStatusCodes": {
                        "type": "array",
                        "items": { "type": "integer", "minimum": 100, "maximum": 599 }
                    }
                },
                "additionalProperties": false
            },
            "timeoutSeconds": { "type": "integer", "minimum": 1, "maximum": 120 }
        })
        .as_object()
        .cloned()
        .unwrap_or_default(),
    );

    let required = [
        "schemaVersion",
        "id",
        "displayName",
        "description",
        "packVersion",
        "actionProtocolVersion",
    ];
    json!({
        "oneOf": [
            {
                "type": "object",
                "properties": cli,
                "required": required.iter().copied().chain([
                    "type", "executableCandidates", "versionArgs", "profiles",
                    "secretBinding", "secretTransport", "resultPolicy", "timeoutSeconds"
                ]).collect::<Vec<_>>(),
                "additionalProperties": false
            },
            {
                "type": "object",
                "properties": http,
                "required": required.iter().copied().chain([
                    "type", "method", "url", "secretBindings", "resultPolicy", "timeoutSeconds"
                ]).collect::<Vec<_>>(),
                "additionalProperties": false
            }
        ]
    })
}
