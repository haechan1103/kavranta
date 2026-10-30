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
  it("puts frequent outbound flows directly in the sidebar, outside the menu", async () => {
    const user = userEvent.setup();
    const actions = renderActions();

    await user.click(screen.getByRole("button", { name: "Push variables" }));
    await user.click(screen.getByRole("button", { name: "Team sharing" }));

    expect(actions.onPush).toHaveBeenCalledOnce();
    expect(actions.onShare).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("moves through the housekeeping menu with the arrow keys and closes on Escape", async () => {
    const user = userEvent.setup();
    renderActions();

    const trigger = screen.getByRole("button", { name: "Project actions" });
    await user.click(trigger);
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(items.at(-1)).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("keeps destructive project removal behind the project menu", async () => {
    const user = userEvent.setup();
    const actions = renderActions();

    await user.click(screen.getByRole("button", { name: "Project actions" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove registration" }));

    expect(actions.onRemove).toHaveBeenCalledOnce();
  });
});
