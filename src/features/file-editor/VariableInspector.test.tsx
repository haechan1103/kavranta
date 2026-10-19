import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import type { OccurrenceProjection } from "../../lib/types";
import { VariableInspector } from "./VariableInspector";

vi.mock("../../lib/api", () => ({
  detachLink: vi.fn(async () => undefined),
  moveVariable: vi.fn(async () => undefined),
  saveDescription: vi.fn(async () => undefined),
  listAgentActivity: vi.fn(async () => [
    {
      timestampMs: 1_000,
      projectId: "demo",
      actor: "claude-code",
      category: "value-read",
      operation: "read_allowed_value",
      relativePaths: [".env.local"],
      variableNames: ["GPT_API_KEY"],
      policyDecision: "policy-checked",
      outcome: "blocked",
      resultCode: "CODEX_ACCESS_BLOCKED",
    },
    {
      timestampMs: 2_000,
      projectId: "demo",
      actor: "codex",
      category: "structure-inspection",
      operation: "inspect_project",
      relativePaths: [],
      variableNames: [],
      policyDecision: "redacted",
      outcome: "allowed",
      resultCode: "OK",
    },
  ]),
}));

const variable: OccurrenceProjection = {
  key: "GPT_API_KEY",
  description: ["Server-only key"],
  valueState: "present",
  displayValue: null,
  codexAccess: "protected",
  linkedCount: 3,
  linkId: "gpt-link",
  linkedFiles: [".env.local", ".env.development", "apps/api/.env"],
  duplicate: false,
  clientExposure: null,
  hasGuide: false,
};

type InspectorProps = ComponentProps<typeof VariableInspector>;

function inspectorProps(overrides: Partial<InspectorProps> = {}): InspectorProps {
  return {
    projectId: "demo",
    file: ".env.local",
    variable,
    sameKeyFiles: variable.linkedFiles,
    currentGroup: "GPT",
    groups: ["GPT", "Database"],
    pendingRemoval: false,
    onStageRemoval: vi.fn(),
    onRestore: vi.fn(),
    onLink: vi.fn(),
    onMutate: vi.fn(async (operation: () => Promise<unknown>) => { await operation(); }),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe("VariableInspector", () => {
  it("lists every linked file and states the save impact", () => {
    render(<VariableInspector {...inspectorProps()} />);

    expect(screen.getByText(".env.development")).toBeInTheDocument();
    expect(screen.getByText("apps/api/.env")).toBeInTheDocument();
    expect(screen.getByText("Saving writes the same value to all 3 files.")).toBeInTheDocument();
  });

  it("asks before detaching and does nothing on Cancel", async () => {
    const user = userEvent.setup();
    vi.mocked(api.detachLink).mockClear();
    render(<VariableInspector {...inspectorProps()} />);

    await user.click(screen.getByRole("button", { name: "Detach this file" }));
    expect(screen.getByRole("dialog", { name: "Detach this file?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.detachLink).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Detach this file" }));
    await user.click(screen.getByRole("button", { name: "Detach" }));
    expect(api.detachLink).toHaveBeenCalledWith("demo", "gpt-link", ".env.local");
  });

  it("offers explicit linking for unlinked same-name occurrences", async () => {
    const user = userEvent.setup();
    const onLink = vi.fn();
    const unlinked = { ...variable, linkedCount: 0, linkId: null, linkedFiles: [] };
    render(<VariableInspector {...inspectorProps({ variable: unlinked, sameKeyFiles: [".env.local", ".env.development"], onLink })} />);

    expect(screen.getByText("The same key exists in 2 files")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Manage together" }));
    expect(onLink).toHaveBeenCalled();
  });

  it("moves a variable through an application dialog", async () => {
    const user = userEvent.setup();
    render(<VariableInspector {...inspectorProps()} />);

    await user.click(screen.getByRole("button", { name: "Move to another group" }));
    await user.click(screen.getByRole("radio", { name: /Database/ }));
    await user.click(screen.getByRole("button", { name: "Move variable" }));

    expect(api.moveVariable).toHaveBeenCalledWith("demo", {
      file: ".env.local",
      key: "GPT_API_KEY",
      targetGroup: "Database",
    });
  });

  it("stages a deletion instead of deleting immediately", async () => {
    const user = userEvent.setup();
    const onStageRemoval = vi.fn();
    render(<VariableInspector {...inspectorProps({ onStageRemoval })} />);

    await user.click(screen.getByRole("button", { name: "Mark for deletion" }));
    expect(onStageRemoval).toHaveBeenCalled();
  });

  it("shows only recent AI activity that names this variable", async () => {
    render(<VariableInspector {...inspectorProps()} />);

    expect(await screen.findByText(/Claude Code/)).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText(/Codex/)).not.toBeInTheDocument();
  });
});
