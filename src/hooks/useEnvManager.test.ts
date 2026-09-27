import { describe, expect, it } from "vitest";

import type { ProjectProjection, ProjectSummary } from "../lib/types";
import { collectSettledProjectScans, resolveSelectedProjectId } from "./useEnvManager";

const projects: ProjectSummary[] = [
  { id: "first", name: "First", displayPath: "/fake/first" },
  { id: "surgery", name: "Surgery", displayPath: "/fake/surgery" },
];

function projection(name: string): ProjectProjection {
  return { name } as unknown as ProjectProjection;
}

describe("resolveSelectedProjectId", () => {
  it("restores the remembered project instead of opening the first project", () => {
    expect(resolveSelectedProjectId(projects, null, "surgery")).toBe("surgery");
  });

  it("keeps a valid in-session selection and falls back from a removed project", () => {
    expect(resolveSelectedProjectId(projects, "surgery", "first")).toBe("surgery");
    expect(resolveSelectedProjectId(projects, null, "removed")).toBe("first");
    expect(resolveSelectedProjectId([], null, "surgery")).toBeNull();
  });
});

describe("collectSettledProjectScans", () => {
  const describe_ = (cause: unknown) => (cause as Error).message;

  it("keeps healthy projections when one project fails to load", () => {
    const settled = collectSettledProjectScans(
      [
        { id: "ok", name: "Ok", displayPath: "/fake/ok" },
        { id: "broken", name: "Broken", displayPath: "/fake/broken" },
        { id: "alsoOk", name: "AlsoOk", displayPath: "/fake/also-ok" },
      ],
      [
        { status: "fulfilled", value: projection("Ok") },
        { status: "rejected", reason: new Error("IO_ERROR") },
        { status: "fulfilled", value: projection("AlsoOk") },
      ],
      describe_,
    );

    expect(Object.keys(settled.projections)).toEqual(["ok", "alsoOk"]);
    expect(settled.projections.ok?.name).toBe("Ok");
    expect(settled.projections.alsoOk?.name).toBe("AlsoOk");
    expect(settled.failures).toEqual({ broken: "IO_ERROR" });
  });

  it("reports every failure instead of collapsing the batch", () => {
    const settled = collectSettledProjectScans(
      projects,
      [
        { status: "rejected", reason: new Error("A") },
        { status: "rejected", reason: new Error("B") },
      ],
      describe_,
    );

    expect(settled.projections).toEqual({});
    expect(settled.failures).toEqual({ first: "A", surgery: "B" });
  });

  it("ignores results without a matching project", () => {
    const settled = collectSettledProjectScans(
      [{ id: "only", name: "Only", displayPath: "/fake/only" }],
      [
        { status: "fulfilled", value: projection("Only") },
        { status: "rejected", reason: new Error("stray") },
      ],
      describe_,
    );

    expect(settled.projections.only?.name).toBe("Only");
    expect(settled.failures).toEqual({});
  });
});
