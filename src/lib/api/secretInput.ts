import type { CodexAccess } from "../types";
import { call, isTauriRuntime } from "./shared";

export interface SecretInputSubmission {
  name: string;
  file: string;
  group?: string;
  description?: string;
  classification?: CodexAccess;
  value: string;
}

export async function submitSecretInput(
  requestId: string,
  projectRoot: string,
  entries: SecretInputSubmission[],
): Promise<void> {
  if (!isTauriRuntime) return;
  return call("submit_secret_input", {
    request: { requestId, projectRoot, entries },
  });
}

export async function cancelSecretInput(requestId: string): Promise<void> {
  if (!isTauriRuntime) return;
  return call("cancel_secret_input", { requestId });
}
