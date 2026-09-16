import { spawn } from "node:child_process";

// Managed by Kavranta Desktop. The app replaces this JSON string literal before installation.
const KAVRANTA_BROKER = "__KAVRANTA_BROKER_PATH__";
const GUARD_TIMEOUT_MS = 5_000;
const MAX_GUARD_INPUT_BYTES = 1_048_576;
const MAX_GUARD_OUTPUT_BYTES = 65_536;
const DIRECT_ACCESS_DENIED =
  "Direct env-file access is blocked by Kavranta. Use the Kavranta MCP tools instead.";
const GUARD_UNAVAILABLE =
  "Kavranta could not validate this operation, so the tool call was blocked. Repair the OpenCode connection in Kavranta.";

function evaluateWithBroker(tool, args) {
  let payload;
  try {
    payload = JSON.stringify({
      hook_event_name: "PreToolUse",
      tool_name: typeof tool === "string" ? tool : "",
      tool_input: args && typeof args === "object" ? args : {},
    });
  } catch {
    return Promise.reject(new Error(GUARD_UNAVAILABLE));
  }
  if (Buffer.byteLength(payload, "utf8") > MAX_GUARD_INPUT_BYTES) {
    return Promise.reject(new Error(GUARD_UNAVAILABLE));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let stdout = "";
    let stdoutBytes = 0;
    const child = spawn(KAVRANTA_BROKER, ["guard-hook"], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const failClosed = () => {
      if (!settled) child.kill();
      finish(() => reject(new Error(GUARD_UNAVAILABLE)));
    };
    const timer = setTimeout(failClosed, GUARD_TIMEOUT_MS);

    child.on("error", failClosed);
    child.stdin.on("error", failClosed);
    child.stdout.on("data", (chunk) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_GUARD_OUTPUT_BYTES) {
        failClosed();
        return;
      }
      stdout += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        failClosed();
        return;
      }
      finish(() => {
        try {
          const decision = JSON.parse(stdout);
          const denied =
            decision?.permission === "deny" ||
            decision?.hookSpecificOutput?.permissionDecision === "deny";
          const allowed =
            decision?.permission === "allow" ||
            (decision &&
              typeof decision === "object" &&
              !Array.isArray(decision) &&
              Object.keys(decision).length === 0);
          if (denied) {
            reject(new Error(DIRECT_ACCESS_DENIED));
          } else if (allowed) {
            resolve();
          } else {
            reject(new Error(GUARD_UNAVAILABLE));
          }
        } catch {
          reject(new Error(GUARD_UNAVAILABLE));
        }
      });
    });
    child.stdin.end(payload);
  });
}

export const KavrantaGuard = async () => ({
  "tool.execute.before": async (input, output) => {
    await evaluateWithBroker(input?.tool, output?.args);
  },
});
