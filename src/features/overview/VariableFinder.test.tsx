import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { demoProjection } from "../../lib/demo";
import { VariableFinder } from "./VariableFinder";

describe("VariableFinder", () => {
  it("bounds displayed results and asks for a narrower query", async () => {
    const user = userEvent.setup();
    const projection = structuredClone(demoProjection);
    const file = projection.files[0]!;
    const group = file.groups[0]!;
    const example = group.variables[0]!;
    group.variables = Array.from({ length: 45 }, (_, index) => ({
      ...example,
      key: `SAMPLE_${index}`,
    }));
    projection.files = [{ ...file, groups: [group] }];
    render(<VariableFinder projection={projection} onOpenFile={vi.fn()} />);
    await user.type(screen.getByRole("searchbox"), "SAMPLE_");
    expect(screen.getAllByRole("button")).toHaveLength(40);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing the first 40 of 45 matches",
    );
    await user.clear(screen.getByRole("searchbox"));
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("finds distinct occurrences across files and opens the chosen key", async () => {
    const user = userEvent.setup();
    const open = vi.fn();
    render(<VariableFinder projection={demoProjection} onOpenFile={open} />);
    await user.type(screen.getByRole("searchbox"), "gpt_api");
    expect(screen.getByRole("status")).toHaveTextContent(
      "2 matching occurrences",
    );
    await user.click(
      screen.getByRole("button", { name: /GPT_API_KEY.*development/ }),
    );
    expect(open).toHaveBeenCalledWith(
      demoProjection.files[1]!.path,
      "GPT_API_KEY",
    );
  });

  it("searches paths but never reads a display value", async () => {
    const user = userEvent.setup();
    const projection = structuredClone(demoProjection);
    for (const file of projection.files)
      for (const group of file.groups) {
        for (const variable of group.variables) {
          Object.defineProperty(variable, "displayValue", {
            get: () => {
              throw new Error("Value field must not be inspected");
            },
          });
        }
      }
    render(<VariableFinder projection={projection} onOpenFile={vi.fn()} />);
    await user.type(screen.getByRole("searchbox"), "apps/web");
    expect(
      screen.getByRole("button", {
        name: /NEXT_PUBLIC_APP_URL.*Missing value/,
      }),
    ).toBeVisible();
    await user.clear(screen.getByRole("searchbox"));
    await user.type(screen.getByRole("searchbox"), "not_a_variable");
    expect(screen.getByRole("status")).toHaveTextContent(
      "0 matching occurrences",
    );
  });
});
