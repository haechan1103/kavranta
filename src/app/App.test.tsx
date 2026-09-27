import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { ProjectSummary } from "../lib/types";

const { useEnvManagerMock } = vi.hoisted(() => ({ useEnvManagerMock: vi.fn() }));
vi.mock("../hooks/useEnvManager", () => ({ useEnvManager: useEnvManagerMock }));
vi.mock("../preferences/DisplayPreferences", () => ({
  supportedFontSizes: ["small", "medium", "large", "extra-large"],
  DisplayPreferencesProvider: ({ children }: { children: ReactNode }) => children,
  useDisplayPreferences: () => ({ fontSize: "medium", setFontSize: vi.fn() }),
}));
vi.mock("../features/integrations/AgentIntegrationStatusProvider", () => ({
  AgentIntegrationStatusProvider: ({ children }: { children: ReactNode }) => children,
  useAgentIntegrationStatus: () => ({
    items: [],
    loading: false,
    refresh: vi.fn(),
    replace: vi.fn(),
    needsAttention: false,
  }),
}));

const project: ProjectSummary = {
  id: "p1",
  name: "haechandev",
  displayPath: "/fake/haechandev",
};

function manager(overrides: Record<string, unknown>) {
  return {
    projects: [] as ProjectSummary[],
    selectedProject: null,
    selectedProjectId: null,
    projection: null,
    selectedProjectFailure: null,
    loading: false,
    error: null,
    notice: null,
    selectProject: vi.fn(),
    register: vi.fn(),
    remove: vi.fn(),
    renameProject: vi.fn(),
    renameEnvFileLabel: vi.fn(),
    renameEnvFileOnDisk: vi.fn(),
    applyGitignoreGuard: vi.fn(),
    refreshProject: vi.fn(),
    reload: vi.fn(),
    clearError: vi.fn(),
    clearNotice: vi.fn(),
    showError: vi.fn(),
    showNotice: vi.fn(),
    ...overrides,
  };
}

describe("App empty and failure states", () => {
  it("shows first-run onboarding only when no project is registered", () => {
    useEnvManagerMock.mockReturnValue(manager({}));

    render(<App />);

    expect(screen.getByText("NO PROJECTS YET")).toBeInTheDocument();
    expect(screen.getByText("Choose a project folder")).toBeInTheDocument();
  });

  it("does not claim there are no projects when a registered project fails to load", () => {
    const reload = vi.fn();
    useEnvManagerMock.mockReturnValue(
      manager({
        projects: [project],
        selectedProject: project,
        selectedProjectId: project.id,
        selectedProjectFailure: "Could not read this project's env files.",
        reload,
      }),
    );

    render(<App />);

    expect(screen.queryByText("NO PROJECTS YET")).not.toBeInTheDocument();
    expect(screen.getByText("Could not open this project")).toBeInTheDocument();
    expect(screen.getByText("Only this project is unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("Could not read this project's env files."),
    ).toBeInTheDocument();
  });

  it("offers a retry that reloads every project", async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    useEnvManagerMock.mockReturnValue(
      manager({
        projects: [project],
        selectedProject: project,
        selectedProjectId: project.id,
        selectedProjectFailure: "IO_ERROR",
        reload,
      }),
    );

    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "Try again" })[0]!);

    expect(reload).toHaveBeenCalled();
  });
});
