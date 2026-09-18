import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { I18nProvider } from "../i18n";
import { CopyButton } from "./CopyButton";

describe("CopyButton", () => {
  it("supports keyboard copying and keeps the action label stable", async () => {
    const user = userEvent.setup();
    const copy = vi.fn(async () => {});
    render(
      <CopyButton className="icon-button" label="Copy value" onCopy={copy} />,
    );

    await user.tab();
    await user.keyboard("{Enter}");

    expect(copy).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    expect(screen.getByRole("button", { name: "Copy value" })).toHaveFocus();
  });

  it("prevents duplicate writes while a copy is pending", async () => {
    let finish: () => void = () => {};
    const copy = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <CopyButton className="icon-button" label="Copy value" onCopy={copy} />,
    );
    const button = screen.getByRole("button", { name: "Copy value" });

    fireEvent.click(button);
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(copy).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(async () => finish());
    expect(button).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
  });

  it("restarts the short feedback interval after another successful copy", async () => {
    vi.useFakeTimers();
    try {
      render(
        <CopyButton
          className="icon-button"
          label="Copy value"
          onCopy={async () => {}}
        />,
      );
      const button = screen.getByRole("button", { name: "Copy value" });
      await act(async () => fireEvent.click(button));
      act(() => vi.advanceTimersByTime(1500));
      await act(async () => fireEvent.click(button));
      act(() => vi.advanceTimersByTime(1500));
      expect(screen.getByRole("status")).toHaveTextContent("Copied");
      act(() => vi.advanceTimersByTime(501));
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reports failure without exposing the error or retaining prior success", async () => {
    const user = userEvent.setup();
    const copy = vi.fn(async () => {});
    render(
      <CopyButton className="icon-button" label="Copy value" onCopy={copy} />,
    );
    const button = screen.getByRole("button", { name: "Copy value" });
    await user.click(button);
    expect(screen.getByRole("status")).toHaveTextContent("Copied");

    copy.mockRejectedValueOnce(new Error("fake_clipboard_failure_payload"));
    await user.click(button);
    expect(screen.getByRole("status")).toHaveTextContent("Copy failed");
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(
      "fake_clipboard_failure_payload",
    );
    expect(button).toBeEnabled();
  });

  it("uses the concise Korean completion message", async () => {
    window.localStorage.setItem("env-manager.locale", "ko");
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <CopyButton
          className="icon-button"
          label="값 복사"
          onCopy={async () => {}}
        />
      </I18nProvider>,
    );
    await user.click(screen.getByRole("button", { name: "값 복사" }));
    expect(screen.getByRole("status")).toHaveTextContent("복사 완료");
  });

  it("does not schedule feedback for a copy that completes after unmount", async () => {
    vi.useFakeTimers();
    let finish: () => void = () => {};
    try {
      const view = render(
        <CopyButton
          className="icon-button"
          label="Copy value"
          onCopy={() =>
            new Promise<void>((resolve) => {
              finish = resolve;
            })
          }
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Copy value" }));
      view.unmount();
      await act(async () => finish());
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
