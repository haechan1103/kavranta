import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { demoProjection } from "../../lib/demo";
import { I18nProvider } from "../../i18n";
import { Overview } from "./Overview";

describe("Overview", () => {
  it("offers recovery instead of a healthy-looking dashboard when no files were found", () => {
    render(<Overview projection={{ ...demoProjection, files: [] }} onOpenFile={vi.fn()} onApplyGitignoreGuard={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Project added. No env data files found yet." })).toBeInTheDocument();
    expect(screen.getByText(/then refresh from Project actions/)).toBeInTheDocument();
    expect(screen.queryByText("All managed env files are ignored")).not.toBeInTheDocument();
    expect(screen.queryByText("Action inbox")).not.toBeInTheDocument();
  });

  it("opens the exact missing occurrence and leaves AI setup optional", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    const connect = vi.fn();
    render(<Overview projection={demoProjection} onOpenFile={open} onOpenIntegrations={connect} onApplyGitignoreGuard={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Fill the next missing value" }));
    const missingFile = demoProjection.files.find((file) => file.groups.some((group) => group.variables.some((variable) => variable.valueState === "empty")));
    expect(open).toHaveBeenCalledWith(missingFile?.path, "NEXT_PUBLIC_APP_URL");
    expect(connect).not.toHaveBeenCalled();
  });

  it("summarizes redacted project state", () => {
    render(
      <Overview
        projection={demoProjection}
        onOpenFile={vi.fn()}
        onApplyGitignoreGuard={vi.fn()}
      />,
    );

    expect(screen.getByText("Action inbox")).toBeInTheDocument();
    expect(screen.getByText("NEXT_PUBLIC_APP_URL")).toBeInTheDocument();
    expect(screen.queryByText("AI access review")).not.toBeInTheDocument();
    expect(screen.getByText("All managed env files are ignored")).toBeInTheDocument();
    expect(screen.getByText("3 values blocked")).toBeInTheDocument();
    expect(screen.queryByText("fake_preview_value")).not.toBeInTheDocument();
    expect(document.querySelector(".issue-icon")).not.toBeInTheDocument();
    expect(document.querySelector(".file-icon")).not.toBeInTheDocument();
    expect(screen.queryByText(/\.env\.local · Value required/)).not.toBeInTheDocument();
  });

  it("offers an explicit fix for env files missing Git ignore coverage", async () => {
    const user = userEvent.setup();
    const apply = vi.fn().mockResolvedValue(undefined);
    render(
      <Overview
        projection={{
          ...demoProjection,
          gitSafety: {
            state: "needs-attention",
            ignoredFiles: [".env.local"],
            missingIgnoreFiles: ["apps/web/.env.local"],
            trackedFiles: ["apps/api/.env.development"],
            historyFiles: [],
            remoteHistoryFiles: [],
          },
        }}
        onOpenFile={vi.fn()}
        onApplyGitignoreGuard={apply}
      />,
    );

    expect(screen.getByText("Git leak risk")).toBeInTheDocument();
    expect(screen.getAllByText("apps/web/.env.local")).toHaveLength(2);
    expect(screen.getByText("apps/api/.env.development")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add exact .gitignore rules" }));
    expect(apply).toHaveBeenCalledOnce();
  });

  it("does not surface AI access review as standalone inbox work", () => {
    render(
      <Overview
        projection={{ ...demoProjection, accessReviewCount: 0 }}
        onOpenFile={vi.fn()}
        onApplyGitignoreGuard={vi.fn()}
      />,
    );

    expect(screen.queryByText("AI access review")).not.toBeInTheDocument();
  });

  it("localizes the action inbox title in Korean", () => {
    window.localStorage.setItem("env-manager.locale", "ko");
    render(
      <I18nProvider>
        <Overview projection={demoProjection} onOpenFile={vi.fn()} onApplyGitignoreGuard={vi.fn()} />
      </I18nProvider>,
    );

    expect(screen.getByText("조치할 항목")).toBeInTheDocument();
    expect(screen.queryByText("Action inbox")).not.toBeInTheDocument();
  });
});
