import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import type { ValueComparison } from "../../lib/types";
import { CompareView } from "./CompareView";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return { ...actual, compareProjectValues: vi.fn() };
});

const comparison: ValueComparison = {
  files: [".env.local", ".env.production"],
  rows: [
    { key: "API_URL", cells: [{ state: "present", group: 0 }, { state: "present", group: 1 }] },
    { key: "PORT", cells: [{ state: "present", group: 0 }, { state: "present", group: 0 }] },
    { key: "SECRET", cells: [{ state: "present", group: 0 }, { state: "missing" }] },
  ],
};

describe("CompareView", () => {
  beforeEach(() => {
    vi.mocked(api.compareProjectValues).mockResolvedValue(comparison);
  });

  it("shows only differences by default and reveals identical rows on request", async () => {
    const user = userEvent.setup();
    render(<CompareView projectId="p" revision={1} onOpenVariable={vi.fn()} onError={vi.fn()} />);

    expect(await screen.findByText("API_URL")).toBeInTheDocument();
    expect(screen.getByText("SECRET")).toBeInTheDocument();
    expect(screen.queryByText("PORT")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /API_URL.*\.env\.local.*Value A/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /API_URL.*\.env\.production.*Value B/ })).toBeInTheDocument();

    await user.click(screen.getByLabelText("Differences only"));
    expect(screen.getByText("PORT")).toBeInTheDocument();
  });

  it("opens the variable in the chosen file", async () => {
    const user = userEvent.setup();
    const onOpenVariable = vi.fn();
    render(<CompareView projectId="p" revision={1} onOpenVariable={onOpenVariable} onError={vi.fn()} />);

    await user.click(await screen.findByRole("button", { name: /API_URL.*\.env\.production/ }));

    expect(onOpenVariable).toHaveBeenCalledWith(".env.production", "API_URL");
  });
});
