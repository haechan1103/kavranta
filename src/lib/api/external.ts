import { call, isTauriRuntime } from "./shared";

export async function openExternal(url: string): Promise<void> {
  if (!isTauriRuntime) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  return call("open_external", { request: { url } });
}
