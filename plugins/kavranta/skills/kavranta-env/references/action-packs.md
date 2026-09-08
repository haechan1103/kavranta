# Action Pack authoring

Use an Action Pack only for one bounded, locally trusted CLI or HTTP operation. It is
not a generic shell or HTTP client. For a concrete user-requested action, an agent may
register a value-free manifest through `plan_install_action_pack`; a recommendation
alone grants no installation authority.

## HTTP

```json
{
  "schemaVersion": 1,
  "id": "local.example.api-check",
  "displayName": "Example API check",
  "description": "Checks one fixed endpoint",
  "packVersion": "1.0.0",
  "actionProtocolVersion": "0.1.0",
  "type": "http",
  "method": "GET",
  "url": "https://api.example.com/health",
  "secretBindings": {
    "Authorization": {
      "source": "header",
      "format": "Bearer {value}"
    }
  },
  "resultPolicy": {
    "status": true,
    "duration": true,
    "body": false,
    "successStatusCodes": [200]
  },
  "timeoutSeconds": 15
}
```

- Use a fixed HTTPS URL. Loopback HTTP is for local development only.
- Do not use URL placeholders, credentials, query strings, fragments, request
  bodies, or response bodies.
- Define 1–16 header bindings. Each format contains exactly one `{value}`.
- `body` must be `false`; redirects and body output are always unavailable.

## CLI

```json
{
  "schemaVersion": 1,
  "id": "local.example.cli-upload",
  "displayName": "Example CLI upload",
  "description": "Sends one value through standard input",
  "packVersion": "1.0.0",
  "actionProtocolVersion": "0.1.0",
  "type": "cli",
  "executableCandidates": ["example-cli"],
  "versionArgs": ["--version"],
  "profiles": [{
    "id": "example-v2-v3",
    "versionRequirement": ">=2,<4",
    "arguments": ["secret", "set", "{variableName}"]
  }],
  "secretBinding": "value",
  "secretTransport": "stdin",
  "resultPolicy": {
    "success": true,
    "exitCode": true,
    "duration": true
  },
  "timeoutSeconds": 30
}
```

- Choose the narrowest semantic-version range verified against official docs.
- Use direct executable candidates only. Shells, interpreters, `.cmd`, and `.bat`
  launchers are rejected.
- Each Profile may contain at most one `{variableName}` across its argument tokens.
  A fixed one-shot generator may omit it and use literal action/output arguments.
- Protocol v1 has one secret binding and `stdin` is the only value transport.
- Never add `{value}` to arguments, environment variables, paths, or files.
- stdout/stderr are discarded. Results contain only status metadata.

## Agent registration

1. Call `list_action_packs` and reuse a matching installed Pack when available.
2. If none matches a concrete requested action, verify the fixed target, executable
   contract, and side effect from authoritative documentation.
3. Call `plan_install_action_pack` with the complete value-free manifest and
   `replace: false` for a new Pack.
4. Verify the redacted plan target, then call `apply_plan` immediately. Do not ask
   the user to repeat the installation in the desktop app.
5. List Packs again, bind managed variable names with `plan_action`, and apply it.

Set `replace: true` only for an explicitly requested Pack update. Never include a
secret, credential, dynamic command, response body, or generated output in the
manifest or plan. The Pack remains installed locally after the task and can be
removed from the Kavranta desktop app.

Use a Personal Provider Pack instead when the operation is a normal per-variable
deployment push with provider targets. Use a compiled official adapter when the
service requires response parsing, OAuth handling, request bodies, value-bearing
arguments, temporary files, multi-step transactions, or provider-specific retries.
