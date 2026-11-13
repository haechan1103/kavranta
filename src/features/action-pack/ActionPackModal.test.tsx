import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { demoProjection } from "../../lib/demo";
import { ActionPackModal } from "./ActionPackModal";

vi.mock("../../lib/api", () => ({
  listActionPacks: vi.fn(async () => [
    {
      id: "local.demo.api-check",
      displayName: "API health check",
      description: "Fixed endpoint",
      packVersion: "1.0.0",
      kind: "http",
      available: true,
      bindings: [{ id: "Authorization", destination: "Authorization" }],
      target: "https://api.example.com/health",
      cliVersion: null,
      profileId: null,
      method: "GET",
      bodyFields: [],
      outputFields: [],
    },
    {
      id: "local.demo.chat",
      displayName: "Model gateway chat",
      description: "Chat request",
      packVersion: "1.0.0",
      kind: "http",
      available: true,
      bindings: [{ id: "GPT_API_KEY", destination: "Authorization" }],
      target: "https://gateway.example.com/v1/chat",
      cliVersion: null,
      profileId: null,
      method: "POST",
      bodyFields: ["model", "max_tokens"],
      outputFields: ["content"],
    },
  ]),
  chooseAndInstallActionPack: vi.fn(async () => null),
  removeActionPack: vi.fn(async () => undefined),
  executeActionPack: vi.fn(async (_projectId: string, request: { packId: string }) => ({
    packId: request.packId,
    kind: "http",
    succeeded: true,
    statusCode: 200,
    durationMs: 42,
    exitCode: null,
    resultCode: "ACTION_SUCCEEDED",
    output: request.packId === "local.demo.chat" ? { content: "Synthetic reply" } : undefined,
  })),
}));

function renderModal() {
  return render(
    <ActionPackModal
      projectId="demo-project"
      projection={demoProjection}
      onClose={vi.fn()}
      onError={vi.fn()}
      onNotice={vi.fn()}
    />,
  );
}

describe("ActionPackModal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the fixed request, maps a variable name to the header and renders only result metadata", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(await screen.findByText("https://api.example.com/health")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Variable for Authorization" }), "GPT_API_KEY");
    await user.click(screen.getByRole("button", { name: /^Send/ }));

    await waitFor(() => expect(api.executeActionPack).toHaveBeenCalledWith(
      "demo-project",
      { packId: "local.demo.api-check", file: ".env.local", bindings: { Authorization: "GPT_API_KEY" } },
    ));
    expect(await screen.findByText(/200 Succeeded · 42 ms/)).toBeInTheDocument();
    expect(JSON.stringify(vi.mocked(api.executeActionPack).mock.calls)).not.toContain("fake_");
  });

  it("suggests the matching variable, sends typed body fields as JSON and shows the projected output", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole("button", { name: /^POST\s*Model gateway chat$/ }));
    expect(screen.getByRole("combobox", { name: "Variable for Authorization" })).toHaveValue("GPT_API_KEY");
    expect(screen.getByRole("button", { name: /^Send/ })).toBeDisabled();
    await user.click(screen.getByRole("tab", { name: /Body/ }));
    await user.type(screen.getByRole("textbox", { name: "Body model value" }), "demo-model");
    await user.type(screen.getByRole("textbox", { name: "Body max_tokens value" }), "64");
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    await waitFor(() => expect(api.executeActionPack).toHaveBeenCalledWith("demo-project", {
      packId: "local.demo.chat",
      file: ".env.local",
      bindings: { GPT_API_KEY: "GPT_API_KEY" },
      body: JSON.stringify({ model: "demo-model", max_tokens: 64 }),
    }));
    expect(await screen.findByText("Synthetic reply")).toBeInTheDocument();
  });
});
