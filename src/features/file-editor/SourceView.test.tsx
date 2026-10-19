import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { SourceView } from "./SourceView";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return { ...actual, readRedactedSource: vi.fn() };
});

describe("SourceView", () => {
  beforeEach(() => {
    vi.mocked(api.readRedactedSource).mockResolvedValue([
      { line: 1, kind: "group", name: "GPT" },
      { line: 2, kind: "comment", text: " Server key" },
      { line: 3, kind: "assignment", key: "GPT_API_KEY", valueState: "present" },
      { line: 4, kind: "assignment", key: "EMPTY_ONE", valueState: "empty" },
      { line: 5, kind: "withheld-comment", key: "OLD_KEY" },
      { line: 6, kind: "unparsed" },
    ]);
  });

  it("renders the file layout with values masked and pending lines marked", async () => {
    render(
      <SourceView
        projectId="p"
        filePath=".env.local"
        revision={1}
        draftKeys={new Set(["GPT_API_KEY"])}
        removalKeys={new Set(["EMPTY_ONE"])}
        onOpenKey={vi.fn()}
        onError={vi.fn()}
      />,
    );

    expect(await screen.findByText("# @group GPT")).toBeInTheDocument();
    expect(screen.getByText("# Server key")).toBeInTheDocument();
    expect(screen.getByLabelText("Value hidden")).toBeInTheDocument();
    expect(screen.getByText("Commented-out value hidden")).toBeInTheDocument();
    expect(screen.getByText("Unreadable line (content hidden)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GPT_API_KEY" }).closest("li")).toHaveClass("pending-replace");
    expect(screen.getByRole("button", { name: "EMPTY_ONE" }).closest("li")).toHaveClass("pending-removal");
  });

  it("opens a variable from its key", async () => {
    const user = userEvent.setup();
    const onOpenKey = vi.fn();
    render(
      <SourceView
        projectId="p"
        filePath=".env.local"
        revision={1}
        draftKeys={new Set()}
        removalKeys={new Set()}
        onOpenKey={onOpenKey}
        onError={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "GPT_API_KEY" }));

    expect(onOpenKey).toHaveBeenCalledWith("GPT_API_KEY");
  });
});
