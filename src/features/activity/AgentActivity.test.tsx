import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { AgentActivity } from "./AgentActivity";

vi.mock("../../lib/api", () => ({
  listAgentActivity: vi.fn(async () => [{
    timestampMs: 1,
    projectId: "demo",
    actor: "claude-code",
    category: "value-read",
    operation: "read_allowed_value",
    relativePaths: [".env.local"],
    variableNames: ["GPT_API_KEY"],
    policyDecision: "policy-checked",
    outcome: "blocked",
    resultCode: "CODEX_ACCESS_BLOCKED",
  }]),
}));

describe("AgentActivity", () => {
  it("shows allowlisted targets and never asks the API for values", async () => {
    const user = userEvent.setup();
    const { container } = render(<AgentActivity projectId="demo" onError={vi.fn()} />);
    expect(await screen.findByText("Value read attempt")).toBeInTheDocument();
    const heading = screen.getByRole("heading", { name: "AI activity" }).parentElement?.parentElement;
    expect(heading).not.toBeNull();
    expect(within(heading!).getByLabelText("AI tool")).toBeInTheDocument();
    expect(screen.getAllByText("Claude Code")).toHaveLength(2);
    expect(container.querySelector('img[src="/brand/agents/claude.svg"]')).toBeInTheDocument();
    expect(screen.getByText("GPT_API_KEY")).toBeInTheDocument();
    expect(screen.getAllByText("Blocked")).toHaveLength(2);
    expect(api.listAgentActivity).toHaveBeenCalledWith("demo");
    expect(screen.queryByText("fake_preview_value")).not.toBeInTheDocument();
    expect(screen.queryByText(/Raw values, value fragments/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing 1 activities/)).not.toBeInTheDocument();

    await user.click(screen.getByText("Technical details"));
    expect(screen.getByText("policy-checked")).toBeInTheDocument();
    expect(screen.getByText("CODEX_ACCESS_BLOCKED")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Allowed/ }));
    expect(screen.getByText("No activity matches these filters.")).toBeInTheDocument();
  });

  it("renders newer audit categories instead of crashing", async () => {
    const { listAgentActivity } = await import("../../lib/api");
    vi.mocked(listAgentActivity).mockResolvedValue([
      {
        timestampMs: 2,
        projectId: "demo",
        actor: "codex",
        category: "secret-input",
        operation: "request_value_input",
        relativePaths: [],
        variableNames: ["GEMINI_API_KEY"],
        policyDecision: "redacted",
        outcome: "allowed",
        resultCode: "OK",
      },
      {
        timestampMs: 3,
        projectId: "demo",
        actor: "codex",
        category: "documentation",
        operation: "plan_set_variable_guide",
        relativePaths: [],
        variableNames: ["GEMINI_API_KEY"],
        policyDecision: "guide-write",
        outcome: "allowed",
        resultCode: "OK",
      },
    ]);
    render(<AgentActivity projectId="demo" onError={vi.fn()} />);

    expect(await screen.findByText("Secret input request")).toBeInTheDocument();
    expect(screen.getByText("Guide documentation")).toBeInTheDocument();
  });
});
