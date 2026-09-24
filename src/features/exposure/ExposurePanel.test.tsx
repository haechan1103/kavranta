import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import type { ExposureProjection } from "../../lib/types";
import { ExposurePanel } from "./ExposurePanel";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return { ...actual, scanExposure: vi.fn(), runRedactionSelfCheck: vi.fn() };
});

const projection: ExposureProjection = {
  state: "scanned",
  deep: false,
  filesScanned: 128,
  durationMs: 41,
  counts: { certain: 1, likely: 0, possible: 0, allowed: 1, managed: 1 },
  findings: [
    {
      path: "credentials.json",
      kind: "credential-file",
      severity: "certain",
      disposition: "exposed",
    },
    {
      path: ".env.local",
      kind: "env-file",
      severity: "certain",
      disposition: "allowed",
      reason: "ai-allowed-variable",
    },
  ],
};

function renderPanel(onError = vi.fn()) {
  return render(<ExposurePanel projectId="project-1" onError={onError} />);
}

describe("ExposurePanel", () => {
  it("lists exposed paths and counts without exposing values", async () => {
    vi.mocked(api.scanExposure).mockResolvedValue(projection);
    const { container } = renderPanel();

    expect(await screen.findByText("credentials.json")).toBeInTheDocument();
    expect(screen.getByText(".env.local")).toBeInTheDocument();
    expect(screen.getByText("AI-allowed variable")).toBeInTheDocument();
    expect(screen.getAllByText("Certain").length).toBeGreaterThan(0);
    expect(screen.getByText("Agent-readable exposed files: 1")).toBeInTheDocument();
    expect(container.textContent ?? "").not.toContain("fake_");

    expect(api.scanExposure).toHaveBeenCalledWith("project-1", false);
  });

  it("shows scan metrics and proves no leaks on demand", async () => {
    vi.mocked(api.scanExposure).mockResolvedValue(projection);
    vi.mocked(api.runRedactionSelfCheck).mockResolvedValue({
      checks: [
        { name: "inspect", passed: true },
        { name: "exposure-scan", passed: true },
        { name: "redacted-occurrences", passed: true },
        { name: "inspect-after-write", passed: true },
        { name: "guide-roundtrip", passed: true },
      ],
      passed: 5,
      total: 5,
      durationMs: 12,
    });
    const user = userEvent.setup();
    renderPanel();

    expect(await screen.findByText("128 files scanned in 41 ms · 0 values read")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Prove no leaks" }));
    expect(await screen.findByText("5/5 checks passed in 12 ms · 0 leaks")).toBeInTheDocument();
  });

  it("rescans with the deep option when enabled", async () => {
    vi.mocked(api.scanExposure).mockResolvedValue({ ...projection, deep: true });
    const user = userEvent.setup();
    renderPanel();

    await screen.findByText("credentials.json");
    await user.click(screen.getByRole("checkbox"));
    await screen.findByText("Agent-readable exposed files: 1");

    expect(api.scanExposure).toHaveBeenLastCalledWith("project-1", true);
  });
});
