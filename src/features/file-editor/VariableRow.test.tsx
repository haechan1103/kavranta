import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import type { OccurrenceProjection } from "../../lib/types";
import { VariableRow } from "./VariableRow";

vi.mock("../../lib/api", () => ({
  setCodexAccess: vi.fn(async () => undefined),
  readValue: vi.fn(async () => "fake_preview_value"),
  copyValue: vi.fn(async () => undefined),
  copyKey: vi.fn(async () => undefined),
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

type RowProps = ComponentProps<typeof VariableRow>;

function rowProps(overrides: Partial<RowProps> = {}): RowProps {
  return {
    projectId: "demo",
    file: ".env.local",
    variable,
    sameKeyFiles: variable.linkedFiles,
    draft: undefined,
    pendingRemoval: false,
    selected: false,
    checked: false,
    saveGeneration: 0,
    onSelect: vi.fn(),
    onOpenDetails: vi.fn(),
    onCheck: vi.fn(),
    onDraftChange: vi.fn(),
    onRevert: vi.fn(),
    onMutate: vi.fn(),
    ...overrides,
  };
}

/** Owns the draft the way FileEditor does, so typing behaves like the real screen. */
function StatefulRow(overrides: Partial<RowProps>) {
  const [draft, setDraft] = useState<string | undefined>(undefined);
  return (
    <VariableRow
      {...rowProps(overrides)}
      draft={draft}
      onDraftChange={setDraft}
      onRevert={() => setDraft(undefined)}
    />
  );
}

const revealTitle = "Show value · hides after 30 seconds of inactivity";

describe("VariableRow", () => {
  it("briefly confirms value copy only after the backend succeeds, and says when it clears", async () => {
    vi.useFakeTimers();
    let finishCopy: () => void = () => {};
    vi.mocked(api.copyValue).mockImplementationOnce(() => new Promise((resolve) => { finishCopy = resolve; }));
    vi.mocked(api.readValue).mockClear();
    try {
      render(<VariableRow {...rowProps()} />);

      fireEvent.click(screen.getByTitle("Copy value"));
      expect(screen.queryByText(/Copied/)).not.toBeInTheDocument();
      await act(async () => finishCopy());
      expect(screen.getByRole("status")).toHaveTextContent("Copied · clears from the clipboard in 45s");
      expect(api.copyValue).toHaveBeenCalledWith("demo", ".env.local", variable.key);
      expect(api.readValue).not.toHaveBeenCalled();
      expect(screen.getByLabelText("GPT_API_KEY value")).toHaveValue("");

      act(() => vi.advanceTimersByTime(3_001));
      expect(screen.queryByText(/Copied/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not restore late copy feedback after a filter hides and restores the row", async () => {
    let finishCopy: () => void = () => {};
    vi.mocked(api.copyValue).mockImplementationOnce(() => new Promise((resolve) => { finishCopy = resolve; }));
    const view = render(<VariableRow {...rowProps({ hidden: false })} />);
    fireEvent.click(screen.getByTitle("Copy value"));
    view.rerender(<VariableRow {...rowProps({ hidden: true })} />);
    view.rerender(<VariableRow {...rowProps({ hidden: false })} />);
    await act(async () => finishCopy());
    expect(screen.queryByText(/Copied/)).not.toBeInTheDocument();
  });

  it("clears a reveal when filtering hides its row", async () => {
    const user = userEvent.setup();
    const view = render(<VariableRow {...rowProps({ hidden: false })} />);
    await user.click(screen.getByTitle(revealTitle));
    expect(await screen.findByDisplayValue("fake_preview_value")).toBeVisible();
    view.rerender(<VariableRow {...rowProps({ hidden: true })} />);
    expect(screen.queryByDisplayValue("fake_preview_value")).not.toBeInTheDocument();
    view.rerender(<VariableRow {...rowProps({ hidden: false })} />);
    expect(screen.getByLabelText("GPT_API_KEY value")).toHaveValue("");
  });

  it("ignores a late reveal after a filter hides and restores the row", async () => {
    let finishRead: (value: string) => void = () => {};
    vi.mocked(api.readValue).mockImplementationOnce(() => new Promise((resolve) => { finishRead = resolve; }));
    const view = render(<VariableRow {...rowProps({ hidden: false })} />);
    fireEvent.click(screen.getByTitle(revealTitle));
    view.rerender(<VariableRow {...rowProps({ hidden: true })} />);
    view.rerender(<VariableRow {...rowProps({ hidden: false })} />);
    await act(async () => finishRead("fake_late_reveal"));
    expect(screen.queryByDisplayValue("fake_late_reveal")).not.toBeInTheDocument();
    expect(screen.getByLabelText("GPT_API_KEY value")).toHaveValue("");
  });

  it("stages a typed replacement with its linked impact and reverts it", async () => {
    const user = userEvent.setup();
    render(<StatefulRow />);

    const input = screen.getByLabelText("GPT_API_KEY value");
    expect(input).toHaveAttribute("placeholder", expect.stringContaining("Value set"));
    await user.type(input, "fake_replacement");

    expect(screen.getByText("Changed")).toBeInTheDocument();
    expect(screen.getByText("saves to 3 files")).toBeInTheDocument();
    expect(screen.getByTitle("Copy value")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Revert" }));
    expect(screen.queryByText("Changed")).not.toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("reverts a typed replacement with Escape", async () => {
    const user = userEvent.setup();
    render(<StatefulRow />);

    const input = screen.getByLabelText("GPT_API_KEY value");
    await user.type(input, "fake_replacement");
    await user.keyboard("{Escape}");

    expect(input).toHaveValue("");
    expect(screen.queryByText("Changed")).not.toBeInTheDocument();
  });

  it("reveals a value only after an explicit action", async () => {
    const user = userEvent.setup();
    render(<VariableRow {...rowProps()} />);

    expect(screen.queryByDisplayValue("fake_preview_value")).not.toBeInTheDocument();
    await user.click(screen.getByTitle(revealTitle));
    const revealed = await screen.findByDisplayValue("fake_preview_value");
    expect(revealed.tagName).toBe("TEXTAREA");
    expect(revealed).toHaveClass("revealed-value-field");
  });

  it("keeps a revealed value visible until 30 seconds of inactivity", async () => {
    vi.useFakeTimers();
    try {
      render(<VariableRow {...rowProps()} />);

      await act(async () => {
        fireEvent.click(screen.getByTitle(revealTitle));
      });
      const revealed = screen.getByDisplayValue("fake_preview_value");

      act(() => vi.advanceTimersByTime(20_000));
      fireEvent.keyDown(revealed, { key: "ArrowRight" });
      act(() => vi.advanceTimersByTime(20_000));
      expect(screen.getByDisplayValue("fake_preview_value")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(10_001));
      expect(screen.queryByDisplayValue("fake_preview_value")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("hides a revealed value after a save so the replaced value is never shown", async () => {
    const user = userEvent.setup();
    const view = render(<VariableRow {...rowProps({ saveGeneration: 0 })} />);

    await user.click(screen.getByTitle(revealTitle));
    expect(await screen.findByDisplayValue("fake_preview_value")).toBeInTheDocument();
    view.rerender(<VariableRow {...rowProps({ saveGeneration: 1 })} />);

    expect(screen.queryByDisplayValue("fake_preview_value")).not.toBeInTheDocument();
  });

  it("shows how many files a linked variable is managed with", () => {
    render(<VariableRow {...rowProps()} />);
    expect(screen.getByText("3 files linked")).toHaveAttribute(
      "title",
      ".env.local · .env.development · apps/api/.env",
    );
  });

  it("points out unlinked same-name occurrences", () => {
    const unlinked = { ...variable, linkedCount: 0, linkId: null, linkedFiles: [] };
    render(<VariableRow {...rowProps({ variable: unlinked, sameKeyFiles: [".env.local", ".env.development"] })} />);
    expect(screen.getByText("Same key in 2 files")).toBeInTheDocument();
  });

  it("copies the environment variable name independently from its value", async () => {
    const user = userEvent.setup();
    render(<VariableRow {...rowProps()} />);

    await user.click(screen.getByRole("button", { name: "Copy GPT_API_KEY environment variable name" }));

    expect(api.copyKey).toHaveBeenCalledWith("demo", "GPT_API_KEY");
    expect(screen.getByTitle("Copied")).toBeInTheDocument();
  });

  it("shows a staged deletion with a restore action instead of the value", async () => {
    const user = userEvent.setup();
    const onRevert = vi.fn();
    render(<VariableRow {...rowProps({ pendingRemoval: true, onRevert })} />);

    expect(screen.getByText("Will be deleted")).toBeInTheDocument();
    expect(screen.queryByLabelText("GPT_API_KEY value")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Restore" }));
    expect(onRevert).toHaveBeenCalled();
  });

  it("invites a value for an empty variable and disables reveal and copy", () => {
    render(<VariableRow {...rowProps({ variable: { ...variable, valueState: "empty" } })} />);

    expect(screen.getByLabelText("GPT_API_KEY value")).toHaveAttribute("placeholder", "Empty · type a value");
    expect(screen.getByTitle(revealTitle)).toBeDisabled();
    expect(screen.getByTitle("Copy value")).toBeDisabled();
  });

  it("sends an AI access upgrade only after the dialog confirms it", async () => {
    const user = userEvent.setup();
    const onMutate = vi.fn(async (operation: () => Promise<unknown>) => { await operation(); });
    vi.mocked(api.setCodexAccess).mockClear();
    render(<VariableRow {...rowProps({ projectId: "fixture-project", onMutate })} />);

    await user.selectOptions(screen.getByRole("combobox", { name: /GPT_API_KEY/ }), "read-write");
    expect(screen.getByRole("dialog", { name: "Let AI tools read GPT_API_KEY?" })).toBeInTheDocument();
    expect(api.setCodexAccess).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Allow AI access" }));

    expect(api.setCodexAccess).toHaveBeenCalledWith("fixture-project", "GPT_API_KEY", "read-write", true);
  });
});
