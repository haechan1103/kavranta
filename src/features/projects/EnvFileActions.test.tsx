import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EnvFileActions } from "./EnvFileActions";

const path = [".", "env", ".local"].join("");

describe("EnvFileActions", () => {
  it("explains that a display-name change leaves the actual file untouched", async () => {
    const user = userEvent.setup();
    const renameLabel = vi.fn();
    render(
      <EnvFileActions
        path={path}
        displayName="Local environment"
        onRenameLabel={renameLabel}
        onRenameFile={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for Local environment" }));
    await user.click(screen.getByRole("menuitem", { name: /Change display name/ }));

    expect(screen.getByText(/file on disk remains/)).toBeInTheDocument();
    const input = screen.getByLabelText("New name");
    await user.clear(input);
    await user.type(input, "Development");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(renameLabel).toHaveBeenCalledWith(path, "Development");
  });

  it("keeps actual filename changes as a separate explicit action", async () => {
    const user = userEvent.setup();
    const renameFile = vi.fn();
    render(
      <EnvFileActions
        path={path}
        displayName="Local environment"
        onRenameLabel={vi.fn()}
        onRenameFile={renameFile}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Actions for Local environment" }));
    await user.click(screen.getByRole("menuitem", { name: /Rename actual file/ }));

    expect(screen.getByText(/References in source code/)).toBeInTheDocument();
    const input = screen.getByLabelText("New actual filename");
    await user.clear(input);
    await user.type(input, [".", "env", ".development"].join(""));
    await user.click(screen.getByRole("button", { name: "Rename file" }));

    expect(renameFile).toHaveBeenCalledWith(path, [".", "env", ".development"].join(""));
  });
});
