import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectSwitcherModal } from "./ProjectSwitcherModal";

const projects = [
  { id: "one", name: "kavranta-skill-test", displayPath: "/private/var/folders/fake" },
  { id: "two", name: "manage_enviroments", displayPath: "/Users/fake/dev/manage_enviroments" },
];

function renderSwitcher(failures: Record<string, string> = {}) {
  return render(
    <ProjectSwitcherModal
      projects={projects}
      selectedProjectId="two"
      projectFailures={failures}
      onClose={vi.fn()}
      onRegister={vi.fn()}
      onSelectProject={vi.fn()}
    />,
  );
}

describe("ProjectSwitcherModal", () => {
  it("renders no failure badge when every project loaded", () => {
    renderSwitcher();
    expect(screen.queryByText("Failed to load")).not.toBeInTheDocument();
  });

  it("shows the load-failed badge inline with the project name, not below the path", () => {
    renderSwitcher({ one: "fake_read_error" });

    const badge = screen.getByText("Failed to load");
    const option = badge.closest(".project-switcher-option");
    expect(option).not.toBeNull();

    // The badge shares a row with the name...
    const title = option!.querySelector(".project-switcher-title");
    expect(title).toContainElement(badge);

    // ...and is not rendered as a third stacked line under the path.
    const copy = option!.querySelector(".project-switcher-copy");
    expect(copy!.querySelectorAll(":scope > small")).toHaveLength(1);
    expect(badge.parentElement).not.toBe(copy);
  });

  it("keeps the reason available as a title for the failed project only", () => {
    renderSwitcher({ one: "fake_read_error" });
    expect(screen.getByText("Failed to load")).toHaveAttribute("title", "fake_read_error");
    expect(screen.getByText("manage_enviroments")).toBeInTheDocument();
  });
});
