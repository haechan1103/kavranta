import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import type { AgentIntegrationStatus } from "../../lib/types";
import { AgentIntegrations } from "./AgentIntegrations";
import { AgentIntegrationStatusProvider } from "./AgentIntegrationStatusProvider";

const integrations: AgentIntegrationStatus[] = [
  {
    id: "codex",
    name: "Codex",
    detected: true,
    installed: true,
    installedVersion: "1.0.0",
    legacyVersion: false,
    currentVersion: "1.0.0",
    updateAvailable: false,
    needsRepair: false,
    activationUnverified: false,
    protection: "broker",
    detail: "The redacted broker is connected.",
    canInstall: true,
    actionBlocker: null,
  },
  {
    id: "claude-code",
    name: "Claude Code",
    detected: true,
    installed: false,
    installedVersion: null,
    legacyVersion: false,
    currentVersion: "1.0.0",
    updateAvailable: false,
    needsRepair: false,
    activationUnverified: false,
    protection: "inactive",
    detail: "The integration can be installed.",
    canInstall: true,
    actionBlocker: null,
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot / VS Code",
    detected: false,
    installed: false,
    installedVersion: null,
    legacyVersion: false,
    currentVersion: "1.0.0",
    updateAvailable: false,
    needsRepair: false,
    activationUnverified: false,
    protection: "inactive",
    detail: "Install the tool to connect it.",
    canInstall: false,
    actionBlocker: "tool-not-found",
  },
  {
    id: "cursor",
    name: "Cursor",
    detected: true,
    installed: false,
    installedVersion: null,
    legacyVersion: false,
    currentVersion: "1.0.0",
    updateAvailable: false,
    needsRepair: false,
    activationUnverified: false,
    protection: "inactive",
    detail: "The integration can be installed.",
    canInstall: true,
    actionBlocker: null,
  },
];

vi.mock("../../lib/api", () => ({
  listAgentIntegrations: vi.fn(async () => integrations),
  installAgentIntegration: vi.fn(async (id: string) => ({
    ...integrations.find((item) => item.id === id)!,
    installed: true,
    installedVersion: "1.0.0",
    protection: "guarded",
  })),
}));

function renderIntegrations(onError = vi.fn(), onNotice = vi.fn()) {
  return render(
    <AgentIntegrationStatusProvider>
      <AgentIntegrations onError={onError} onNotice={onNotice} />
    </AgentIntegrationStatusProvider>,
  );
}

describe("AgentIntegrations", () => {
  it("shows all supported hosts without exposing env values", async () => {
    const { container } = renderIntegrations();

    expect(await screen.findByText("Codex")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("GitHub Copilot / VS Code")).toBeInTheDocument();
    expect(screen.getByText("Cursor")).toBeInTheDocument();
    expect(container.querySelector('img[src="/brand/agents/openai.svg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/brand/agents/claude.svg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/brand/agents/github.svg"]')).toBeInTheDocument();
    expect(container.querySelector('img[src="/brand/agents/cursor.svg"]')).toBeInTheDocument();
    expect(screen.queryByText(/API_KEY=/)).not.toBeInTheDocument();
  });

  it("tells Cursor users to reload the window after local installation", async () => {
    const user = userEvent.setup();
    const onNotice = vi.fn();
    renderIntegrations(vi.fn(), onNotice);

    const cursorCard = (await screen.findByText("Cursor")).closest("article");
    expect(cursorCard).not.toBeNull();
    await user.click(within(cursorCard!).getByRole("button", { name: "Install connection" }));

    expect(api.installAgentIntegration).toHaveBeenCalledWith("cursor");
    expect(onNotice).toHaveBeenCalledWith(expect.stringContaining("Reload Window"));
  });

  it("labels a locally installed Cursor plugin as configured until host activation is confirmed", async () => {
    vi.mocked(api.listAgentIntegrations).mockResolvedValueOnce([
      {
        ...integrations[3]!,
        installed: true,
        installedVersion: "1.0.0",
        activationUnverified: true,
        protection: "guarded",
      },
    ]);
    renderIntegrations();

    const cursorCard = (await screen.findByText("Cursor")).closest("article");
    expect(cursorCard).not.toBeNull();
    expect(within(cursorCard!).getByText("Configured")).toBeInTheDocument();
    expect(within(cursorCard!).queryByText("Connected")).not.toBeInTheDocument();
    expect(within(cursorCard!).getByText(/confirm Kavranta is active/)).toBeInTheDocument();
  });

  it("installs the selected host through the shared integration API", async () => {
    const user = userEvent.setup();
    const onNotice = vi.fn();
    renderIntegrations(vi.fn(), onNotice);

    const claudeCard = (await screen.findByText("Claude Code")).closest("article");
    expect(claudeCard).not.toBeNull();
    await user.click(within(claudeCard!).getByRole("button", { name: "Install connection" }));

    expect(api.installAgentIntegration).toHaveBeenCalledWith("claude-code");
    expect(onNotice).toHaveBeenCalledWith(expect.stringContaining("Claude Code"));
  });

  it("explains why an integration action is disabled", async () => {
    renderIntegrations();

    const copilotCard = (await screen.findByText("GitHub Copilot / VS Code")).closest("article");
    expect(copilotCard).not.toBeNull();
    expect(within(copilotCard!).getByText(/CLI was not found/)).toBeInTheDocument();
  });

  it("labels app-linked plugin versions as legacy bundle state", async () => {
    vi.mocked(api.listAgentIntegrations).mockResolvedValueOnce([
      { ...integrations[0]!, installedVersion: "0.5.0", legacyVersion: true, updateAvailable: true },
    ]);
    renderIntegrations();

    expect(await screen.findByText("0.5.0 (legacy app-linked) → 1.0.0")).toBeInTheDocument();
  });

  it("offers repair when the plugin version exists but its broker configuration is stale", async () => {
    vi.mocked(api.listAgentIntegrations).mockResolvedValueOnce([
      { ...integrations[0]!, needsRepair: true, protection: "inactive" },
    ]);
    renderIntegrations();

    expect(await screen.findByText("Repair needed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Repair connection" })).toBeEnabled();
  });

  it("keeps legacy cleanup visible and retryable after the Kavranta connection is ready", async () => {
    vi.mocked(api.listAgentIntegrations).mockResolvedValueOnce([
      { ...integrations[0]!, migrationPending: true },
    ]);
    renderIntegrations();

    expect(await screen.findByText(/legacy Env Manager connection remains/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update" })).toBeEnabled();
  });
});
