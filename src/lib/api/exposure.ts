import type { ExposureProjection, RedactionProof } from "../types";
import { call, isTauriRuntime } from "./shared";

const demoExposure: ExposureProjection = {
  state: "scanned",
  deep: false,
  filesScanned: 128,
  durationMs: 41,
  counts: { certain: 3, likely: 1, possible: 0, allowed: 1, managed: 1 },
  findings: [
    {
      path: ".env.local",
      kind: "env-file",
      severity: "certain",
      disposition: "managed",
    },
    {
      path: ".env.development",
      kind: "env-file",
      severity: "certain",
      disposition: "allowed",
      reason: "ai-allowed-variable",
    },
    {
      path: "credentials.json",
      kind: "credential-file",
      severity: "certain",
      disposition: "exposed",
    },
    {
      path: "apps/web/.npmrc",
      kind: "npmrc",
      severity: "certain",
      disposition: "exposed",
    },
    {
      path: ".cursor/mcp.json",
      kind: "mcp-config",
      severity: "likely",
      disposition: "exposed",
    },
  ],
};

export async function scanExposure(
  projectId: string,
  deep = false,
): Promise<ExposureProjection> {
  if (!isTauriRuntime) {
    return { ...demoExposure, deep };
  }
  return call("scan_exposure", { request: { projectId, deep } });
}

const demoProof: RedactionProof = {
  checks: [
    { name: "inspect", passed: true },
    { name: "exposure-scan", passed: true },
    { name: "redacted-occurrences", passed: true },
    { name: "inspect-after-write", passed: true },
    { name: "guide-roundtrip", passed: true },
  ],
  passed: 5,
  total: 5,
  durationMs: 12,
};

export async function runRedactionSelfCheck(): Promise<RedactionProof> {
  if (!isTauriRuntime) {
    return demoProof;
  }
  return call("run_redaction_self_check");
}
