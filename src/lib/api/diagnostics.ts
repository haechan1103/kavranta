import { save } from "@tauri-apps/plugin-dialog";

import { call, isTauriRuntime } from "./shared";

export interface DiagnosticsResult {
  destination: string;
  projectCount: number;
  failedProjectCount: number;
  variableCount: number;
}

function defaultFileName(): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  return `kavranta-diagnostics-${stamp}.json`;
}

/**
 * Asks for a destination and lets Rust write the value-free diagnostics report.
 * The report body never enters the frontend, so it cannot be logged or resent.
 * Returns `null` when the user cancels the save dialog.
 */
export async function exportDiagnosticsReport(
  dialogTitle: string,
): Promise<DiagnosticsResult | null> {
  if (!isTauriRuntime) {
    return {
      destination: defaultFileName(),
      projectCount: 0,
      failedProjectCount: 0,
      variableCount: 0,
    };
  }
  const destination = await save({
    title: dialogTitle,
    defaultPath: defaultFileName(),
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (typeof destination !== "string") {
    return null;
  }
  return call("build_diagnostics_report", { request: { destination } });
}
