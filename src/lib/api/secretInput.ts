import type { CodexAccess, SecretInputResult } from "../types";
import { call, isTauriRuntime } from "./shared";

export interface SecretInputSubmission {
  name: string;
  file: string;
  group?: string;
  description?: string;
  classification?: CodexAccess;
  value: string;
}

/// Returns one outcome per submitted name so the caller can report what actually landed.
/// An entry with an empty value is skipped rather than written, so "the dialog closed" and
/// "the value was stored" are different facts and the caller must show which happened.
export async function submitSecretInput(
  requestId: string,
  projectRoot: string,
  entries: SecretInputSubmission[],
): Promise<SecretInputResult[]> {
  if (!isTauriRuntime) return [];
  return call("submit_secret_input", {
    request: { requestId, projectRoot, entries },
  });
}

export async function cancelSecretInput(requestId: string): Promise<void> {
  if (!isTauriRuntime) return;
  return call("cancel_secret_input", { requestId });
}
