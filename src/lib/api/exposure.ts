import type { ExposureProjection } from "../types";
import { call, isTauriRuntime } from "./shared";

const demoExposure: ExposureProjection = {
  state: "scanned",
  deep: false,
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
