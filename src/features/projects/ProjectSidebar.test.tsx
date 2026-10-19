import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { ProjectProjection } from "../../lib/types";
import { AgentIntegrationStatusProvider } from "../integrations/AgentIntegrationStatusProvider";
import { ProjectSidebar } from "./ProjectSidebar";

const projection: ProjectProjection = {
  projectId: "demo",
  name: "demo",
  unclassifiedCount: 0,
  accessReviewCount: 0,
  issueCount: 0,
  clientExposureCount: 0,
  classificationReview: [],
  gitSafety: {
    state: "protected",
    ignoredFiles: [".env.local"],
    missingIgnoreFiles: [],
    trackedFiles: [],
    historyFiles: [],
    remoteHistoryFiles: [],
  },
  files: [{ path: ".env.local", displayName: ".env.local", warnings: [], groups: [] }],
};

describe("ProjectSidebar", () => {
  it("shows only the current project and switches from the project dialog", async () => {
    const user = userEvent.setup();
    const selectProject = vi.fn();
    render(
      <AgentIntegrationStatusProvider>
        <ProjectSidebar
          projects={[
            { id: "demo", name: "demo", displayPath: "/fake/demo" },
            { id: "second", name: "second", displayPath: "/fake/second" },
          ]}
          selectedProjectId="demo"
          projection={projection}
          projectFailures={{}}
          view={{ kind: "overview" }}
          onSelectProject={selectProject}
          onSelectView={vi.fn()}
          onRegister={vi.fn()}
          onExportDiagnostics={vi.fn()}
          onRenameFileLabel={vi.fn()}
          onRenameFileOnDisk={vi.fn()}
          projectActions={<button type="button">Project actions</button>}
        />
      </AgentIntegrationStatusProvider>,
    );

    expect(screen.getByLabelText("Current project")).toHaveTextContent("demo");
    expect(screen.queryByText("second")).not.toBeInTheDocument();
    expect(screen.queryByText("PROJECTS")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Access review" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current project")).not.toHaveTextContent("Project actions");
    expect(screen.getByRole("navigation", { name: "Project views" })).toHaveTextContent("Project actions");

    await user.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("heading", { name: "Switch project" })).toBeInTheDocument();
    expect(screen.getByText("/fake/second")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /second/ }));

    expect(selectProject).toHaveBeenCalledWith("second");
    expect(screen.queryByRole("heading", { name: "Switch project" })).not.toBeInTheDocument();
  });

  it("starts registration from the project dialog", async () => {
    const user = userEvent.setup();
    const register = vi.fn();
    render(
      <AgentIntegrationStatusProvider>
        <ProjectSidebar
          projects={[{ id: "demo", name: "demo", displayPath: "/fake/demo" }]}
          selectedProjectId="demo"
          projection={projection}
          projectFailures={{}}
          view={{ kind: "overview" }}
          onSelectProject={vi.fn()}
          onSelectView={vi.fn()}
          onRegister={register}
          onRenameFileLabel={vi.fn()}
          onRenameFileOnDisk={vi.fn()}
          onExportDiagnostics={vi.fn()}
        />
      </AgentIntegrationStatusProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Change" }));
    await user.click(screen.getByRole("button", { name: "Add project" }));

    expect(register).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("heading", { name: "Switch project" })).not.toBeInTheDocument();
  });

  it("shows an attention dot when a detected AI host connection needs an update", async () => {
    vi.useFakeTimers();
    try {
      render(
        <AgentIntegrationStatusProvider>
          <ProjectSidebar
            projects={[{ id: "demo", name: "demo", displayPath: "/fake/demo" }]}
            selectedProjectId="demo"
            projection={projection}
            projectFailures={{}}
            view={{ kind: "overview" }}
            onSelectProject={vi.fn()}
            onSelectView={vi.fn()}
            onRegister={vi.fn()}
            onExportDiagnostics={vi.fn()}
            onRenameFileLabel={vi.fn()}
            onRenameFileOnDisk={vi.fn()}
          />
        </AgentIntegrationStatusProvider>,
      );

      expect(screen.queryByLabelText("AI tool connection needs attention")).not.toBeInTheDocument();
      await act(async () => vi.advanceTimersByTimeAsync(1500));
      expect(screen.getByLabelText("AI tool connection needs attention")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks only the project that failed to load", async () => {
    const user = userEvent.setup();
    render(
      <AgentIntegrationStatusProvider>
        <ProjectSidebar
          projects={[
            { id: "broken", name: "broken", displayPath: "/fake/broken" },
            { id: "healthy", name: "healthy", displayPath: "/fake/healthy" },
          ]}
          selectedProjectId="broken"
          projection={null}
          projectFailures={{ broken: "IO_ERROR" }}
          view={{ kind: "overview" }}
          onSelectProject={vi.fn()}
          onSelectView={vi.fn()}
          onRegister={vi.fn()}
          onExportDiagnostics={vi.fn()}
          onRenameFileLabel={vi.fn()}
          onRenameFileOnDisk={vi.fn()}
        />
      </AgentIntegrationStatusProvider>,
    );

    expect(screen.getAllByText("Failed to load")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Change" }));
    const brokenRow = screen.getByRole("button", { name: /broken/ });
    const healthyRow = screen.getByRole("button", { name: /healthy/ });
    expect(brokenRow.className).toContain("failed");
    expect(healthyRow.className).not.toContain("failed");
  });

  it("offers a value-free diagnostics export from the sidebar footer", async () => {
    const user = userEvent.setup();
    const onExportDiagnostics = vi.fn();
    render(
      <AgentIntegrationStatusProvider>
        <ProjectSidebar
          projects={[{ id: "demo", name: "demo", displayPath: "/fake/demo" }]}
          selectedProjectId="demo"
          projection={projection}
          projectFailures={{}}
          view={{ kind: "overview" }}
          onSelectProject={vi.fn()}
          onSelectView={vi.fn()}
          onRegister={vi.fn()}
          onExportDiagnostics={onExportDiagnostics}
          onRenameFileLabel={vi.fn()}
          onRenameFileOnDisk={vi.fn()}
        />
      </AgentIntegrationStatusProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Export diagnostics" }));

    expect(onExportDiagnostics).toHaveBeenCalledWith("Save diagnostics report");
  });
});
