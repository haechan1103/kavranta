import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { VariableGuideModal, splitGuideSteps } from "./VariableGuideModal";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return { ...actual, readVariableGuide: vi.fn() };
});

const multiStep = [
  "# Get your key",
  "",
  "Read this first.",
  "",
  "## Step one",
  "",
  "Do the first thing at https://example.com/first.",
  "",
  "## Step two",
  "",
  "Do the second thing.",
  "",
].join("\n");

function renderModal() {
  render(
    <VariableGuideModal projectId="project-1" name="GEMINI_API_KEY" onClose={vi.fn()} onError={vi.fn()} />,
  );
}

describe("splitGuideSteps", () => {
  it("keeps level-2 headings inside code fences in the same step", () => {
    const steps = splitGuideSteps(["# Title", "", "```", "## not a step", "```", "", "## Real step", "", "Body"].join("\n"));
    expect(steps).toHaveLength(2);
    expect(steps[0]).toContain("## not a step");
    expect(steps[1]).toMatch(/^## Real step/);
  });

  it("returns one step when there are no level-2 headings", () => {
    expect(splitGuideSteps("# Title\n\nJust text.")).toHaveLength(1);
  });
});

describe("VariableGuideModal", () => {
  it("pages through headed sections with previous and next", async () => {
    vi.mocked(api.readVariableGuide).mockResolvedValue(multiStep);
    const user = userEvent.setup();
    renderModal();

    expect(await screen.findByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("Read this first.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText(/Do the first thing/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("refreshes the guide on demand instead of polling", async () => {
    vi.mocked(api.readVariableGuide).mockClear();
    vi.mocked(api.readVariableGuide).mockResolvedValue("# Title\n\nVersion one.");
    const user = userEvent.setup();
    renderModal();

    expect(await screen.findByText("Version one.")).toBeInTheDocument();
    vi.mocked(api.readVariableGuide).mockResolvedValue("# Title\n\nVersion two.");
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("Version two.")).toBeInTheDocument();
    expect(vi.mocked(api.readVariableGuide)).toHaveBeenCalledTimes(2);
  });

  it("hides step navigation for a single step", async () => {
    vi.mocked(api.readVariableGuide).mockResolvedValue("# Title\n\nJust text.");
    renderModal();

    expect(await screen.findByText("Just text.")).toBeInTheDocument();
    expect(screen.queryByText(/\d \/ \d/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});
