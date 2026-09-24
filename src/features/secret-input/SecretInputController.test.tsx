import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectProjection, SecretInputEvent } from "../../lib/types";
import { SecretInputController } from "./SecretInputController";

const { listenMock } = vi.hoisted(() => ({ listenMock: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: listenMock }));
vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return { ...actual, isTauriRuntime: true, submitSecretInput: vi.fn(), cancelSecretInput: vi.fn() };
});

type Listener = (event: { payload: SecretInputEvent }) => void;

function emit(event: SecretInputEvent) {
  const call = listenMock.mock.calls[0];
  if (!call) throw new Error("secret-input listener was not registered");
  (call[1] as Listener)({ payload: event });
}

function projectionWithGuide(): ProjectProjection {
  return {
    files: [
      {
        path: ".env.local",
        displayName: ".env.local",
        groups: [
          {
            name: "AI Keys",
            variables: [{ key: "GEMINI_API_KEY", hasGuide: true }],
          },
        ],
        warnings: [],
      },
    ],
  } as unknown as ProjectProjection;
}

const emptyProjection = { files: [] } as unknown as ProjectProjection;

const request = {
  requestId: "req-9",
  projectRoot: "/synthetic/other-project",
  timeoutSeconds: 300,
  entries: [{ name: "GEMINI_API_KEY", file: ".env.local", group: "AI Keys" }],
};

describe("SecretInputController", () => {
  beforeEach(() => {
    listenMock.mockClear();
  });

  it("loads the requesting project's projection for guides instead of the selected one", async () => {
    listenMock.mockResolvedValue(vi.fn());
    const refreshProject = vi.fn().mockResolvedValue(projectionWithGuide());
    render(
      <SecretInputController
        projectId="selected-1"
        projection={emptyProjection}
        refreshProject={refreshProject}
        onError={vi.fn()}
      />,
    );

    emit({ request, projectId: "requested-9" });

    expect(refreshProject).toHaveBeenCalledWith("requested-9");
    expect(
      await screen.findByRole("button", { name: "Guide for GEMINI_API_KEY" }),
    ).toBeInTheDocument();
  });

  it("falls back to the selected projection when the event carries no project", async () => {
    listenMock.mockResolvedValue(vi.fn());
    const refreshProject = vi.fn();
    render(
      <SecretInputController
        projectId="selected-1"
        projection={projectionWithGuide()}
        refreshProject={refreshProject}
        onError={vi.fn()}
      />,
    );

    emit({ request, projectId: null });

    expect(refreshProject).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "Guide for GEMINI_API_KEY" }),
    ).toBeInTheDocument();
  });
});
