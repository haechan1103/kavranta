import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import type { OccurrenceProjection, ProjectProjection } from "../../lib/types";
import { FileEditor } from "./FileEditor";

vi.mock("../../lib/api", () => ({
  createGroup: vi.fn(async () => ({ affectedFiles: [".env.local"], keys: [] })),
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

describe("FileEditor", () => {
  it("combines metadata search with missing-only filtering and reports no matches", async () => {
    const user = userEvent.setup();
    render(<FileEditor projectId="demo" filePath={projection.files[0]!.path} projection={{ ...projection,
      files: [{ ...projection.files[0]!, groups: [{ name: "App", variables: [
        { ...variable("PORT", "empty"), description: ["Listener address"] }, variable("MODE"),
      ] }] }],
    }} onRefresh={vi.fn()} onError={vi.fn()} onNotice={vi.fn()} />);
    await user.type(screen.getByRole("searchbox"), "listener");
    await user.click(screen.getByRole("button", { name: /Missing values only/ }));
    expect(screen.getByText("PORT")).toBeVisible();
    expect(screen.getByText("MODE")).not.toBeVisible();
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "MODE");
    expect(screen.getByText("No variables match these filters")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show all variables" }));
    expect(screen.getByText("PORT")).toBeVisible();
    expect(screen.getByText("MODE")).toBeVisible();
  });

  it("preserves an unsaved draft when search hides and restores its row", async () => {
    const user = userEvent.setup();
    render(<FileEditor projectId="demo" filePath={projection.files[0]!.path} projection={{ ...projection,
      files: [{ ...projection.files[0]!, groups: [{ name: "App", variables: [variable("PORT"), variable("MODE")] }] }],
    }} onRefresh={vi.fn()} onError={vi.fn()} onNotice={vi.fn()} />);
    await user.type(screen.getByLabelText("PORT value"), "fake_draft_only");
    await user.type(screen.getByRole("searchbox"), "MODE");
    expect(screen.getByText("PORT")).not.toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show all variables" }));
    expect(screen.getByLabelText("PORT value")).toHaveValue("fake_draft_only");
    expect(screen.getByLabelText("PORT value")).toBeVisible();
  });

  it("opens with the variable search supplied by the overview", () => {
    render(<FileEditor projectId="demo" filePath={projection.files[0]!.path} initialSearch="MODE" projection={{ ...projection,
      files: [{ ...projection.files[0]!, groups: [{ name: "App", variables: [variable("PORT"), variable("MODE")] }] }],
    }} onRefresh={vi.fn()} onError={vi.fn()} onNotice={vi.fn()} />);
    expect(screen.getByRole("searchbox")).toHaveValue("MODE");
    expect(screen.getByText("PORT")).not.toBeVisible();
    expect(screen.getByText("MODE")).toBeVisible();
  });
  it("creates an explicit empty group from the file header", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn(async () => undefined);
    render(
      <FileEditor
        projectId="demo"
        projection={projection}
        filePath=".env.local"
        onRefresh={refresh}
        onError={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    expect(screen.getByText("No variables yet. Add a new variable to this group.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Organize comments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Jump to environment variable group" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "+ New group" }));
    await user.type(screen.getByLabelText("Group name"), "Database");
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(api.createGroup).toHaveBeenCalledWith("demo", {
      file: ".env.local",
      name: "Database",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows sticky group shortcuts only for files with at least ten variables", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    const scrollBy = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    HTMLElement.prototype.scrollBy = scrollBy;
    const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    const scrollWidth = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(600);
    const largeProjection: ProjectProjection = {
      ...projection,
      files: [{
        ...projection.files[0]!,
        groups: [
          { name: "GPT", variables: Array.from({ length: 5 }, (_, index) => variable(`GPT_${index}`)) },
          { name: "Database", variables: Array.from({ length: 5 }, (_, index) => variable(`DB_${index}`)) },
        ],
      }],
    };

    render(
      <FileEditor
        projectId="demo"
        projection={largeProjection}
        filePath=".env.local"
        onRefresh={vi.fn(async () => undefined)}
        onError={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    const navigation = screen.getByRole("navigation", { name: "Jump to environment variable group" });
    expect(navigation).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Database · 5" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Next groups" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Next groups" }));
    expect(scrollBy).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "All groups" }));
    expect(navigation).toHaveClass("expanded");
    expect(screen.queryByRole("button", { name: "Next groups" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse groups" }));
    expect(navigation).not.toHaveClass("expanded");
    expect(screen.getByRole("button", { name: "Next groups" })).toBeInTheDocument();

    clientWidth.mockRestore();
    scrollWidth.mockRestore();
  });

  it("filters the file view to variables whose values are empty", async () => {
    const user = userEvent.setup();
    const filterProjection: ProjectProjection = {
      ...projection,
      files: [{
        ...projection.files[0]!,
        groups: [
          {
            name: "GPT",
            variables: [variable("GPT_API_KEY", "empty"), variable("GPT_MODEL")],
          },
          {
            name: "Database",
            variables: [variable("DATABASE_URL")],
          },
        ],
      }],
    };

    render(
      <FileEditor
        projectId="demo"
        projection={filterProjection}
        filePath=".env.local"
        onRefresh={vi.fn(async () => undefined)}
        onError={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    expect(screen.getByText("GPT_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("GPT_MODEL")).toBeInTheDocument();
    expect(screen.getByText("DATABASE_URL")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Missing values only/ }));

    expect(screen.getByText("GPT_API_KEY")).toBeInTheDocument();
    expect(screen.getByText("GPT_MODEL")).not.toBeVisible();
    expect(screen.getByText("DATABASE_URL")).not.toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Database" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 3 variables")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Missing values only/ }));
    expect(screen.getByText("DATABASE_URL")).toBeInTheDocument();
  });

  it("explains when the selected file has no empty variables", async () => {
    const user = userEvent.setup();
    const completeProjection: ProjectProjection = {
      ...projection,
      files: [{
        ...projection.files[0]!,
        groups: [{ name: "GPT", variables: [variable("GPT_API_KEY")] }],
      }],
    };

    render(
      <FileEditor
        projectId="demo"
        projection={completeProjection}
        filePath=".env.local"
        onRefresh={vi.fn(async () => undefined)}
        onError={vi.fn()}
        onNotice={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Missing values only/ }));

    expect(screen.getByText("Every variable has a value")).toBeInTheDocument();
    expect(screen.getByText("GPT_API_KEY")).not.toBeVisible();
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
