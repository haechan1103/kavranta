import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { useConfirm } from "./ConfirmDialog";
import { Modal } from "./Modal";

function Harness({ onResult, nested = false, onOuterClose = () => undefined }: {
  onResult: (confirmed: boolean) => void;
  nested?: boolean;
  onOuterClose?: () => void;
}) {
  const { confirm, dialog } = useConfirm();
  const [outerOpen, setOuterOpen] = useState(nested);
  const ask = () =>
    void confirm({
      title: "Delete SAMPLE_KEY?",
      body: "This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    }).then(onResult);
  return (
    <>
      {outerOpen ? (
        <Modal title="Outer" onClose={() => { setOuterOpen(false); onOuterClose(); }}>
          <button onClick={ask}>Ask</button>
        </Modal>
      ) : (
        <button onClick={ask}>Ask</button>
      )}
      {dialog}
    </>
  );
}

describe("useConfirm", () => {
  it("resolves true only from the confirm button", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);

    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByRole("dialog", { name: "Delete SAMPLE_KEY?" })).toHaveTextContent("This cannot be undone.");
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts on Cancel so Enter does not confirm a destructive action", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    render(<Harness onResult={onResult} />);

    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("closes only the innermost dialog on Escape", async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();
    const onOuterClose = vi.fn();
    render(<Harness nested onResult={onResult} onOuterClose={onOuterClose} />);

    await user.click(screen.getByRole("button", { name: "Ask" }));
    await user.keyboard("{Escape}");

    expect(onResult).toHaveBeenCalledWith(false);
    expect(onOuterClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Outer" })).toBeInTheDocument();
  });
});
