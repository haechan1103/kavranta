import type { MutationSummary } from "../types";
import { call, isTauriRuntime } from "./shared";

export async function readVariableGuide(
  projectId: string,
  key: string,
): Promise<string | null> {
  if (!isTauriRuntime) return null;
  return call("read_variable_guide", { request: { projectId, key } });
}

export interface GuideAttachment {
  mimeType: string;
  base64: string;
}

export async function readGuideAttachment(
  projectId: string,
  key: string,
  file: string,
): Promise<GuideAttachment | null> {
  if (!isTauriRuntime) return null;
  return call("read_guide_attachment", { request: { projectId, key, file } });
}

export async function saveVariableGuide(
  projectId: string,
  key: string,
  markdown: string,
): Promise<MutationSummary> {
  if (!isTauriRuntime) return { affectedFiles: [], keys: [key] };
  return call("save_variable_guide", { request: { projectId, key, markdown } });
}

export async function removeVariableGuide(
  projectId: string,
  key: string,
): Promise<MutationSummary> {
  if (!isTauriRuntime) return { affectedFiles: [], keys: [key] };
  return call("remove_variable_guide", { request: { projectId, key } });
}
