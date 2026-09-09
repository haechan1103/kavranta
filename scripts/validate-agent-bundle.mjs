import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const version = (await read("plugins/kavranta/VERSION")).trim();
const codex = JSON.parse(await read("plugins/kavranta/.codex-plugin/plugin.json"));
const claude = JSON.parse(await read("plugins/kavranta/.claude-plugin/plugin.json"));
const cursor = JSON.parse(await read("plugins/kavranta/.cursor-plugin/plugin.json"));
const codexMarketplace = JSON.parse(await read(".agents/plugins/marketplace.json"));
const claudeMarketplace = JSON.parse(await read(".claude-plugin/marketplace.json"));
const mcp = JSON.parse(await read("plugins/kavranta/.mcp.json"));
const cursorMcp = JSON.parse(await read("plugins/kavranta/mcp.json"));
const hooks = JSON.parse(await read("plugins/kavranta/hooks/hooks.json"));
const cursorHooks = JSON.parse(await read("plugins/kavranta/cursor-hooks/hooks.json"));
const skill = await read("plugins/kavranta/skills/kavranta-env/SKILL.md");
const skillInterface = await read("plugins/kavranta/skills/kavranta-env/agents/openai.yaml");
const normalizedSkill = skill.replace(/\r\n?/g, "\n");
const productName = "Kavranta";
const repository = "https://github.com/haechan1103/kavranta";

assert(codex.name === "kavranta", "Codex plugin name must be kavranta");
assert(claude.name === "kavranta", "Claude plugin name must be kavranta");
assert(cursor.name === "kavranta", "Cursor plugin name must be kavranta");
assert(
  codex.interface?.displayName === productName,
  `Codex plugin display name must be ${productName}`,
);
assert(codex.repository === repository, "Codex plugin must reference the Kavranta repository");
assert(claude.repository === repository, "Claude plugin must reference the Kavranta repository");
assert(cursor.repository === repository, "Cursor plugin must reference the Kavranta repository");
assert(
  codexMarketplace.interface?.displayName === productName,
  `Codex marketplace display name must be ${productName}`,
);
assert(
  codex.interface?.defaultPrompt?.length <= 3,
  "Codex plugin must expose at most three starter prompts",
);
assert(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version), "Agent bundle version must be semantic");
assert(codex.version === version, "Codex plugin version must match the agent bundle");
assert(claude.version === version, "Claude plugin version must match the agent bundle");
assert(cursor.version === version, "Cursor plugin version must match the agent bundle");
assert(claudeMarketplace.plugins?.[0]?.version === version, "Claude marketplace version must match the agent bundle");
assert(mcp.mcpServers?.kavranta?.command === "kavranta-broker", "MCP must use the Kavranta broker command");
assert(cursorMcp.mcpServers?.kavranta?.command === "kavranta-broker", "Cursor MCP must use the Kavranta broker command");
assert(Array.isArray(hooks.hooks?.PreToolUse), "PreToolUse Guard is required");
assert(cursor.skills === "./skills/", "Cursor plugin must load the shared Skill directory");
assert(cursor.mcpServers === "./mcp.json", "Cursor plugin must load its MCP config");
assert(cursor.hooks === "./cursor-hooks/hooks.json", "Cursor plugin must load its hook config");
assert(cursorHooks.version === 1, "Cursor hooks schema version must be 1");
for (const event of ["preToolUse", "beforeReadFile", "beforeTabFileRead"]) {
  const entries = cursorHooks.hooks?.[event];
  assert(Array.isArray(entries) && entries.length === 1, `Cursor ${event} Guard is required`);
  assert(entries[0]?.command === "kavranta-broker guard-hook", `Cursor ${event} must use the Kavranta Guard`);
  assert(entries[0]?.timeout === 5, `Cursor ${event} must use the bounded timeout`);
  assert(entries[0]?.failClosed === true, `Cursor ${event} Guard must fail closed`);
}
assert(
  cursorHooks.hooks.preToolUse[0]?.matcher === "Shell|Read|Write|Grep|Delete",
  "Cursor preToolUse must cover every direct env tool type",
);
assert(normalizedSkill.startsWith("---\nname: kavranta-env\n"), "Skill frontmatter is missing");
assert(normalizedSkill.includes("Kavranta"), "Skill discovery must include the Kavranta product name");
assert(normalizedSkill.includes("환경변수"), "Skill discovery must include a Korean environment-variable trigger");
assert(skillInterface.includes('display_name: "Kavranta Env Management"'), "Skill display name must use Kavranta");
assert(skillInterface.includes("한국어"), "Skill default prompt must advertise the Korean workflow");
assert(normalizedSkill.includes("plan_register_current_project"), "Skill must route safe current-project registration");
assert(normalizedSkill.includes("find_reusable_variable_sources"), "Skill must route redacted cross-project source discovery");
assert(normalizedSkill.includes("find_registered_projects"), "Skill must resolve registered project aliases before asking for paths");
assert(normalizedSkill.includes("search_registered_variable_sources"), "Skill must route bounded variable-name discovery");
assert(normalizedSkill.includes("plan_copy_variable_from_project"), "Skill must route opaque cross-project copy plans");
assert(normalizedSkill.includes("plan_provider_push"), "Skill must route opaque provider push plans");
assert(normalizedSkill.includes("personal-provider-packs.md"), "Skill must route Personal Provider Pack authoring");
assert(normalizedSkill.includes("list_action_packs"), "Skill must route installed Action Pack discovery");
assert(normalizedSkill.includes("plan_action"), "Skill must route opaque Action Pack plans");
assert(normalizedSkill.includes("action-packs.md"), "Skill must route Action Pack authoring");
assert(normalizedSkill.includes("plan_stdin_value_write"), "Skill must route opaque stdin value plans");
assert(normalizedSkill.includes("stdin-value-ingest.md"), "Skill must route opaque stdin value guidance");
assert(normalizedSkill.includes(".dev.vars"), "Skill must route Wrangler .dev.vars files through the broker");

process.stdout.write(`Agent bundle ${version} is internally consistent and versioned independently from the app.\n`);

async function read(path) {
  return readFile(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
