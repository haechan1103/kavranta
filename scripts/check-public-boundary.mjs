import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const MAX_SCANNED_FILE_BYTES = 8 * 1024 * 1024;
const SYNTHETIC_ENV_DIRECTORIES = [
  "crates/env-test-support/fixtures/",
  "tests/fixtures/",
];

const blockedExtensions = new Set([
  ".agekey",
  ".jks",
  ".key",
  ".keystore",
  ".mobileprovision",
  ".p12",
  ".pem",
  ".pfx",
  ".provisionprofile",
]);

const blockedBasenames = new Set([
  ".netrc",
  "credentials.json",
  "googleservice-info.plist",
  "google-services.json",
  "id_ed25519",
  "id_rsa",
  "service-account.json",
]);

// Secret shapes live in one place so the runtime detector and this boundary scan can
// never drift apart. The catalog is a constrained matcher spec, not a regex, so the Rust
// side needs no regex engine and the data file cannot carry a backtracking pattern.
const secretPatternCatalog = JSON.parse(
  readFileSync("config/secret-patterns.json", "utf8"),
);

/** Compile one catalog rule into an equivalent RegExp for this scanner. */
function ruleToRegExp(rule) {
  const body = rule.segments
    .map((segment) =>
      "literal" in segment
        ? escapeRegExp(segment.literal)
        : `[${escapeRegExp(secretPatternCatalog.charsets[segment.run])}]{${segment.min},${segment.max}}`,
    )
    .join("");
  return new RegExp(body, "g");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&");
}

const credentialPatterns = secretPatternCatalog.rules.map((rule) => [
  rule.id,
  ruleToRegExp(rule),
]);

function classifyPath(normalized) {
  const basename = path.posix.basename(normalized).toLowerCase();
  const extension = path.posix.extname(basename);
  const isEnvFile = basename === ".env"
    || basename.startsWith(".env.")
    || basename === ".dev.vars"
    || basename.startsWith(".dev.vars.");
  const isSyntheticEnv = SYNTHETIC_ENV_DIRECTORIES.some((directory) =>
    normalized.startsWith(directory),
  );

  if (isEnvFile && !isSyntheticEnv) {
    return "tracked-env-file";
  }
  if (blockedExtensions.has(extension) || blockedBasenames.has(basename)) {
    return "private-credential-file";
  }
  return null;
}

function credentialRules(content) {
  return credentialPatterns
    .filter(([, pattern]) => {
      pattern.lastIndex = 0;
      return pattern.test(content);
    })
    .map(([rule]) => rule);
}

function runSelfTest() {
  assert.equal(classifyPath("apps/web/.env.local"), "tracked-env-file");
  assert.equal(classifyPath("workers/api/.dev.vars.production"), "tracked-env-file");
  assert.equal(classifyPath("tests/fixtures/.env.local"), null);
  assert.equal(classifyPath("release/signing.key"), "private-credential-file");
  assert.deepEqual(credentialRules(`prefix ${"AKIA" + "FAKE".repeat(4)} suffix`), [
    "aws-access-key",
  ]);
}

runSelfTest();

const publishableFiles = [
  ...new Set(
    execFileSync(
      "git",
      ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
      { encoding: "utf8" },
    )
      .split("\0")
      .filter(Boolean),
  ),
].filter((file) => existsSync(file));

const failures = [];

for (const file of publishableFiles) {
  const normalized = file.replaceAll("\\", "/");
  const pathRule = classifyPath(normalized);
  if (pathRule) {
    failures.push([normalized, pathRule]);
    continue;
  }

  const bytes = readFileSync(normalized);
  if (bytes.length > MAX_SCANNED_FILE_BYTES || bytes.includes(0)) {
    continue;
  }
  const content = bytes.toString("utf8");
  for (const rule of credentialRules(content)) {
    failures.push([normalized, rule]);
  }
}

if (failures.length > 0) {
  console.error("Public repository boundary check failed:");
  for (const [file, rule] of failures) {
    console.error(`- ${file}: ${rule}`);
  }
  console.error(
    "No matching content was printed. Remove the file or rotate the credential before continuing.",
  );
  process.exit(1);
}

console.log(
  `Public repository boundary is clean across ${publishableFiles.length} publishable files.`,
);
