import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectActions } from "./ProjectActions";

function renderActions() {
  const actions = {
    onRename: vi.fn(),
    onExport: vi.fn(),
    onImport: vi.fn(),
    onShare: vi.fn(),
    onPush: vi.fn(),
    onRunAction: vi.fn(),
    onRefresh: vi.fn(),
    onRemove: vi.fn(),
  };
  render(<ProjectActions {...actions} />);
  return actions;
}

describe("ProjectActions", () => {
  it("keeps every project-level action available from one menu", async () => {
    const user = userEvent.setup();
    const actions = renderActions();

    await user.click(screen.getByRole("button", { name: "Project actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Push variables" }));

    expect(actions.onPush).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menuitem", { name: "Push variables" })).not.toBeInTheDocument();
  });

  it("keeps destructive project removal behind the project menu", async () => {
    const user = userEvent.setup();
    const actions = renderActions();

    await user.click(screen.getByRole("button", { name: "Project actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove registration" }));

    expect(actions.onRemove).toHaveBeenCalledOnce();
  });
});
