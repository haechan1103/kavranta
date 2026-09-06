import { open } from "@tauri-apps/plugin-dialog";

import { demoProjects } from "../demo";
import type { ProjectSummary, RenameEnvFileSummary } from "../types";
import { call, isTauriRuntime } from "./shared";

export async function chooseAndRegisterProject(dialogTitle: string): Promise<ProjectSummary | null> {
  if (!isTauriRuntime) {
    return demoProjects[0] ?? null;
  }
  const root = await open({ directory: true, multiple: false, title: dialogTitle });
  if (typeof root !== "string") {
    return null;
  }
  return call("register_project", { root });
}
export async function removeProject(projectId: string): Promise<void> {
  if (!isTauriRuntime) return;
  return call("remove_project", { request: { projectId } });
}

export async function renameProject(projectId: string, name: string): Promise<ProjectSummary> {
  if (!isTauriRuntime) {
    const project = demoProjects.find((item) => item.id === projectId) ?? {
      id: projectId,
      name,
      displayPath: "/demo/project",
    };
    return { ...project, name };
  }
  return call("rename_project", { request: { projectId, name } });
}

export async function renameEnvFileLabel(projectId: string, file: string, name: string): Promise<void> {
  if (!isTauriRuntime) return;
  return call("rename_env_file_label", { request: { projectId, file, name } });
}

export async function renameEnvFileOnDisk(
  projectId: string,
  file: string,
  newName: string,
): Promise<RenameEnvFileSummary> {
  if (!isTauriRuntime) {
    const segments = file.split("/");
    segments[segments.length - 1] = newName;
    return { oldFile: file, newFile: segments.join("/") };
  }
  return call("rename_env_file_on_disk", { request: { projectId, file, newName } });
}
