import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import type { OccurrenceProjection, ProjectProjection } from "../../lib/types";
import { FileEditor } from "./FileEditor";

vi.mock("../../lib/api", () => ({
  createGroup: vi.fn(async () => ({ affectedFiles: [".env.local"], keys: [] })),
  saveValue: vi.fn(async () => ({ affectedFiles: [".env.local"], keys: [] })),
  deleteVariable: vi.fn(async () => ({ affectedFiles: [".env.local"], keys: [] })),
  listAgentActivity: vi.fn(async () => []),
  readValue: vi.fn(async () => "fake_preview_value"),
  copyValue: vi.fn(async () => undefined),
  copyKey: vi.fn(async () => undefined),
  setCodexAccess: vi.fn(async () => undefined),
}));

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
  files: [
    {
      path: ".env.local",
      displayName: ".env.local",
      warnings: [],
      groups: [{ name: "GPT", variables: [] }],
    },
  ],
};

function withVariables(groups: { name: string; variables: OccurrenceProjection[] }[]): ProjectProjection {
  return { ...projection, files: [{ ...projection.files[0]!, groups }] };
}

type EditorProps = ComponentProps<typeof FileEditor>;

function editorProps(overrides: Partial<EditorProps> = {}): EditorProps {
  return {
    projectId: "demo",
    projection,
    filePath: ".env.local",
    onRefresh: vi.fn(async () => undefined),
    onError: vi.fn(),
    onNotice: vi.fn(),
    ...overrides,
  };
}

describe("FileEditor", () => {
  it("combines metadata search with the empty filter and reports no matches", async () => {
    const user = userEvent.setup();
    render(<FileEditor {...editorProps({ projection: withVariables([{ name: "App", variables: [
      { ...variable("PORT", "empty"), description: ["Listener address"] }, variable("MODE"),
    ] }]) })} />);

    await user.type(screen.getByRole("searchbox"), "listener");
    await user.click(screen.getByRole("button", { name: /^Empty/ }));
    expect(screen.getByText("PORT")).toBeVisible();
    expect(screen.getByText("MODE")).not.toBeVisible();
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "MODE");
    expect(screen.getByText("No variables match these filters")).toBeVisible();
    await user.clear(screen.getByRole("searchbox"));
    await user.click(screen.getByRole("button", { name: /^All/ }));
    expect(screen.getByText("MODE")).toBeVisible();
  });

  it("keeps a typed draft when search hides and restores its row", async () => {
    const user = userEvent.setup();
    render(<FileEditor {...editorProps({ projection: withVariables([{ name: "App", variables: [variable("PORT"), variable("MODE")] }]) })} />);

    await user.type(screen.getByLabelText("PORT value"), "fake_draft_only");
    await user.type(screen.getByRole("searchbox"), "MODE");
    expect(screen.getByLabelText("PORT value")).not.toBeVisible();
    await user.clear(screen.getByRole("searchbox"));
    expect(screen.getByLabelText("PORT value")).toHaveValue("fake_draft_only");
  });

  it("opens with the variable search supplied by the overview", () => {
    render(<FileEditor {...editorProps({ initialSearch: "MODE", projection: withVariables([{ name: "App", variables: [variable("PORT"), variable("MODE")] }]) })} />);
    expect(screen.getByRole("searchbox")).toHaveValue("MODE");
    expect(screen.getByText("PORT")).not.toBeVisible();
    expect(screen.getByText("MODE")).toBeVisible();
  });

  it("creates an explicit empty group from the file header", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn(async () => undefined);
    render(<FileEditor {...editorProps({ onRefresh: refresh })} />);

    expect(screen.getByText("No variables yet. Add a new variable to this group.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ New group" }));
    await user.type(screen.getByLabelText("Group name"), "Database");
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(api.createGroup).toHaveBeenCalledWith("demo", { file: ".env.local", name: "Database" });
    expect(refresh).toHaveBeenCalled();
  });

  it("filters to empty values and says when none remain", async () => {
    const user = userEvent.setup();
    const view = render(<FileEditor {...editorProps({ projection: withVariables([
      { name: "GPT", variables: [variable("GPT_API_KEY", "empty"), variable("GPT_MODEL")] },
      { name: "Database", variables: [variable("DATABASE_URL")] },
    ]) })} />);

    await user.click(screen.getByRole("button", { name: /^Empty/ }));
    expect(screen.getByText("GPT_API_KEY")).toBeVisible();
    expect(screen.getByText("GPT_MODEL")).not.toBeVisible();
    expect(screen.getByRole("heading", { name: "Database", hidden: true })).not.toBeVisible();

    view.rerender(<FileEditor {...editorProps({ projection: withVariables([
      { name: "GPT", variables: [variable("GPT_API_KEY")] },
    ]) })} />);
    expect(screen.getByText("Every variable has a value")).toBeInTheDocument();
  });

  it("collapses a group without losing its rows", async () => {
    const user = userEvent.setup();
    render(<FileEditor {...editorProps({ projection: withVariables([{ name: "GPT", variables: [variable("GPT_MODEL")] }]) })} />);

    const toggle = screen.getByRole("button", { name: /GPT/, expanded: true });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("GPT_MODEL")).not.toBeVisible();
  });

  it("stages typed values and saves them together", async () => {
    const user = userEvent.setup();
    const onNotice = vi.fn();
    const onPendingChange = vi.fn();
    vi.mocked(api.saveValue).mockClear();
    render(<FileEditor {...editorProps({ onNotice, onPendingChange, projection: withVariables([
      { name: "App", variables: [variable("PORT"), variable("MODE")] },
    ]) })} />);

    await user.type(screen.getByLabelText("PORT value"), "fake_port");
    await user.type(screen.getByLabelText("MODE value"), "fake_mode");
    const bar = screen.getByRole("region", { name: "Pending changes" });
    expect(bar).toHaveTextContent("2 pending");
    expect(onPendingChange).toHaveBeenLastCalledWith(2);
    expect(api.saveValue).not.toHaveBeenCalled();

    await user.click(within(bar).getByRole("button", { name: /^Save/ }));

    expect(api.saveValue).toHaveBeenCalledWith("demo", { file: ".env.local", key: "PORT", newValue: "fake_port" });
    expect(api.saveValue).toHaveBeenCalledWith("demo", { file: ".env.local", key: "MODE", newValue: "fake_mode" });
    expect(onNotice).toHaveBeenCalledWith("Saved 2 changes to 1 files.");
    expect(screen.queryByRole("region", { name: "Pending changes" })).not.toBeInTheDocument();
    expect(onPendingChange).toHaveBeenLastCalledWith(0);
  });

  it("saves with the keyboard shortcut", async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveValue).mockClear();
    render(<FileEditor {...editorProps({ projection: withVariables([{ name: "App", variables: [variable("PORT")] }]) })} />);

    await user.type(screen.getByLabelText("PORT value"), "fake_port");
    await user.keyboard("{Meta>}s{/Meta}");

    expect(api.saveValue).toHaveBeenCalledTimes(1);
  });

  it("asks once before a save that deletes, naming the keys", async () => {
    const user = userEvent.setup();
    vi.mocked(api.deleteVariable).mockClear();
    render(<FileEditor {...editorProps({ projection: withVariables([{ name: "App", variables: [variable("PORT"), variable("MODE")] }]) })} />);

    await user.click(screen.getByRole("checkbox", { name: "Select PORT" }));
    await user.click(screen.getByRole("checkbox", { name: "Select MODE" }));
    await user.click(screen.getByRole("button", { name: "Mark for deletion" }));
    expect(screen.getAllByText("Will be deleted")).toHaveLength(2);
    expect(api.deleteVariable).not.toHaveBeenCalled();

    const bar = screen.getByRole("region", { name: "Pending changes" });
    await user.click(within(bar).getByRole("button", { name: /^Save/ }));
    const dialog = screen.getByRole("dialog", { name: "Delete 2 variables?" });
    expect(dialog).toHaveTextContent("PORT · MODE");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(api.deleteVariable).not.toHaveBeenCalled();
    expect(screen.getAllByText("Will be deleted")).toHaveLength(2);

    await user.click(within(bar).getByRole("button", { name: /^Save/ }));
    await user.click(screen.getByRole("button", { name: "Save and delete 2" }));
    expect(api.deleteVariable).toHaveBeenCalledWith("demo", { file: ".env.local", key: "PORT" });
    expect(api.deleteVariable).toHaveBeenCalledWith("demo", { file: ".env.local", key: "MODE" });
  });

  it("keeps a failed item pending and names it", async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    vi.mocked(api.saveValue).mockReset();
    vi.mocked(api.saveValue)
      .mockResolvedValueOnce({ affectedFiles: [".env.local"], keys: ["PORT"] })
      .mockRejectedValueOnce(new Error("write failed"));
    render(<FileEditor {...editorProps({ onError, projection: withVariables([{ name: "App", variables: [variable("PORT"), variable("MODE")] }]) })} />);

    await user.type(screen.getByLabelText("PORT value"), "fake_port");
    await user.type(screen.getByLabelText("MODE value"), "fake_mode");
    await user.click(screen.getByRole("button", { name: /^Save/ }));

    expect(onError).toHaveBeenCalledWith("Saved 1. These did not save and are still pending: MODE");
    expect(screen.getByRole("region", { name: "Pending changes" })).toHaveTextContent("1 pending");
    expect(screen.getByLabelText("MODE value")).toHaveValue("fake_mode");
    expect(screen.getByLabelText("PORT value")).toHaveValue("");
  });

  it("keeps drafts through an external change and says what changed", async () => {
    const user = userEvent.setup();
    const props = editorProps({ projection: withVariables([{ name: "App", variables: [variable("PORT")] }]) });
    const view = render(<FileEditor {...props} />);

    await user.type(screen.getByLabelText("PORT value"), "fake_port");
    view.rerender(<FileEditor {...props} projection={withVariables([{ name: "App", variables: [variable("PORT"), variable("SENTRY_DSN")] }])} />);

    expect(screen.getByRole("alert")).toHaveTextContent("This file was changed by another program.");
    expect(screen.getByRole("alert")).toHaveTextContent("Added: SENTRY_DSN.");
    expect(screen.getByLabelText("PORT value")).toHaveValue("fake_port");
  });

  it("keeps the details column in place on wide windows, empty until something is selected", async () => {
    const user = userEvent.setup();
    render(<FileEditor {...editorProps({ projection: withVariables([{ name: "App", variables: [variable("PORT")] }]) })} />);

    expect(screen.getByRole("complementary", { name: "Variable details" })).toHaveTextContent("Select a variable");
    await user.click(screen.getByRole("button", { name: "PORT" }));
    expect(screen.getByRole("complementary", { name: "Details for PORT" })).toBeInTheDocument();
  });

  it("opens the narrow-window drawer from the row, never from editing a value", async () => {
    const user = userEvent.setup();
    const matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
    try {
      render(<FileEditor {...editorProps({ projection: withVariables([{ name: "App", variables: [variable("PORT")] }]) })} />);

      await user.type(screen.getByLabelText("PORT value"), "fake_port");
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();

      await user.click(screen.getByText("PORT").closest("article")!);
      expect(screen.getByRole("complementary", { name: "Details for PORT" })).toBeInTheDocument();
    } finally {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });
});

function variable(
  key: string,
  valueState: OccurrenceProjection["valueState"] = "present",
): OccurrenceProjection {
  return {
    key,
    description: [],
    valueState,
    displayValue: null,
    codexAccess: "protected",
    linkedCount: 1,
    linkId: null,
    linkedFiles: [],
    duplicate: false,
    clientExposure: null,
    hasGuide: false,
  };
}
