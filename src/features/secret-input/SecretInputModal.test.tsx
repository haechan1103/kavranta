import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import type { ProjectProjection, SecretInputRequest } from "../../lib/types";
import { SecretInputModal } from "./SecretInputModal";

vi.mock("../../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../../lib/api")>("../../lib/api");
  return { ...actual, submitSecretInput: vi.fn(), cancelSecretInput: vi.fn() };
});

const projection = {
  files: [
    {
      path: ".env.local",
      displayName: ".env.local",
      groups: [{ name: "API Keys", variables: [] }],
      warnings: [],
    },
  ],
} as unknown as ProjectProjection;

const request: SecretInputRequest = {
  requestId: "req-1",
  projectRoot: "/synthetic/project",
  timeoutSeconds: 300,
  entries: [
    { name: "GEMINI_API_KEY", file: ".env.local", group: "API Keys", classification: "protected" },
    { name: "OPENROUTER_API_KEY", file: ".env.local" },
  ],
};

describe("SecretInputModal", () => {
  it("submits typed values to the backend and closes", async () => {
    vi.mocked(api.submitSecretInput).mockResolvedValue();
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SecretInputModal request={request} projectId="project-1" projection={projection} onClose={onClose} onError={vi.fn()} />,
    );

    const rowFor = (name: string) =>
      screen.getByText(name).closest(".secret-input-row") as HTMLElement;
    await user.type(within(rowFor("GEMINI_API_KEY")).getByLabelText("Value"), "fake_gemini_key");
    await user.type(
      within(rowFor("OPENROUTER_API_KEY")).getByLabelText("Value"),
      "fake_openrouter_key",
    );
    await user.click(screen.getByRole("button", { name: "Save values" }));

    expect(api.submitSecretInput).toHaveBeenCalledWith(
      "req-1",
      "/synthetic/project",
      expect.arrayContaining([
        expect.objectContaining({ name: "GEMINI_API_KEY", value: "fake_gemini_key" }),
        expect.objectContaining({ name: "OPENROUTER_API_KEY", value: "fake_openrouter_key" }),
      ]),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("cancels the request when the user dismisses it", async () => {
    vi.mocked(api.cancelSecretInput).mockResolvedValue();
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<SecretInputModal request={request} projectId="project-1" projection={projection} onClose={onClose} onError={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.cancelSecretInput).toHaveBeenCalledWith("req-1");
    expect(onClose).toHaveBeenCalled();
  });
});
