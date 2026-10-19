import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CommandPalette, rank, type PaletteItem } from "./CommandPalette";

function items(): PaletteItem[] {
  return [
    { id: "var:a", group: "variables", label: "GPT_API_KEY", detail: ".env.local", run: vi.fn() },
    { id: "var:b", group: "variables", label: "DATABASE_URL", detail: ".env.local", run: vi.fn() },
    { id: "file:a", group: "files", label: ".env.local", run: vi.fn() },
    { id: "view:activity", group: "views", label: "AI activity", run: vi.fn() },
    { id: "cmd:push", group: "commands", label: "Push variables", run: vi.fn() },
  ];
}

describe("rank", () => {
  it("lists views and commands but no variables before anything is typed", () => {
    expect(rank(items(), "").map((item) => item.id)).toEqual(["file:a", "view:activity", "cmd:push"]);
  });

  it("requires every word and ranks a label prefix first", () => {
    expect(rank(items(), "api gpt").map((item) => item.id)).toEqual(["var:a"]);
    expect(rank(items(), "push")[0]?.id).toBe("cmd:push");
  });
});

describe("CommandPalette", () => {
  it("runs the highlighted result on Enter and closes", async () => {
    const user = userEvent.setup();
    const all = items();
    const onClose = vi.fn();
    render(<CommandPalette items={all} onClose={onClose} />);

    await user.type(screen.getByRole("combobox"), "database");
    expect(screen.getByRole("option", { name: /DATABASE_URL/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Enter}");

    expect(all[1]?.run).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalled();
  });

  it("moves the highlight with the arrow keys and closes on Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CommandPalette items={items()} onClose={onClose} />);

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("option", { name: "AI activity" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
  });

  it("states that values are never searched", () => {
    render(<CommandPalette items={items()} onClose={vi.fn()} />);
    expect(screen.getByText("Names only, never values")).toBeInTheDocument();
  });
});
