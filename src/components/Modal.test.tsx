import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Modal } from "./Modal";

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      {open && (
        <Modal title="Move variable" onClose={() => setOpen(false)}>
          <input aria-label="Destination" autoFocus />
          <button onClick={() => setOpen(false)}>Done</button>
        </Modal>
      )}
    </>
  );
}

describe("Modal", () => {
  it("focuses the intended control and returns focus after Escape", async () => {
    const user = userEvent.setup();
    render(<ModalHarness />);

    const opener = screen.getByRole("button", { name: "Open dialog" });
    await user.click(opener);

    expect(screen.getByRole("textbox", { name: "Destination" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("wraps keyboard focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(
      <Modal title="Keyboard dialog" onClose={() => undefined}>
        <button>First action</button>
        <button>Last action</button>
      </Modal>,
    );

    const first = screen.getByRole("button", { name: "Close dialog" });
    const last = screen.getByRole("button", { name: "Last action" });
    last.focus();
    await user.keyboard("{Tab}");
    expect(first).toHaveFocus();
  });
});
