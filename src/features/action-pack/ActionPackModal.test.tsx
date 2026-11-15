import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as api from "../../lib/api";
import { demoProjection } from "../../lib/demo";
import type { ActionRunRecord, SavedActionRequest } from "../../lib/types";
import { ActionPackModal } from "./ActionPackModal";

const saved: SavedActionRequest[] = [];
const history: ActionRunRecord[] = [];

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
  listActionRequests: vi.fn(async () => [...saved]),
  saveActionRequest: vi.fn(async (projectId: string, input: { id?: string; name: string; request: { packId: string; file: string; bindings: Record<string, string>; body?: string } }) => {
    const entry: SavedActionRequest = {
      id: input.id ?? `saved-${saved.length + 1}`,
      projectId,
      packId: input.request.packId,
      name: input.name,
      file: input.request.file,
      bindings: input.request.bindings,
      body: input.request.body,
      updatedAt: 1,
    };
    saved.push(entry);
    return entry;
  }),
  deleteActionRequest: vi.fn(async () => undefined),
  listActionHistory: vi.fn(async () => [...history]),
  clearActionHistory: vi.fn(async () => undefined),
  chooseAndInstallActionPack: vi.fn(async () => null),
  removeActionPack: vi.fn(async () => undefined),
  executeActionPack: vi.fn(async (projectId: string, request: { packId: string }, requestName?: string) => {
    const result = {
      packId: request.packId,
      kind: "http" as const,
      succeeded: true,
      statusCode: 200,
      durationMs: 42,
      exitCode: null,
      resultCode: "ACTION_SUCCEEDED",
      output: request.packId === "local.demo.chat" ? { content: "Synthetic reply" } : undefined,
    };
    history.unshift({ ...result, id: `run-${history.length}`, projectId, requestName, at: 1, output: result.output ?? {} });
    return result;
  }),
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

const chatButton = { name: /^POST\s*Model gateway chat$/ };

describe("ActionPackModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saved.splice(0, saved.length);
    history.splice(0, history.length);
  });

  it("shows the fixed request, maps a variable name to the header and renders only result metadata", async () => {
    const user = userEvent.setup();
    renderModal();

    expect(await screen.findByText("https://api.example.com/health")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Variable for Authorization" }), "GPT_API_KEY");
    await user.click(screen.getByRole("button", { name: /^Send/ }));

    await waitFor(() => expect(api.executeActionPack).toHaveBeenCalledWith(
      "demo-project",
      { packId: "local.demo.api-check", file: ".env.local", bindings: { Authorization: "GPT_API_KEY" } },
      undefined,
    ));
    expect(await screen.findByText(/200 Succeeded · 42 ms/)).toBeInTheDocument();
    expect(JSON.stringify(vi.mocked(api.executeActionPack).mock.calls)).not.toContain("fake_");
  });

  it("suggests the matching variable, sends typed body fields as JSON and shows the projected output", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole("button", chatButton));
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
    }, undefined));
    expect(await screen.findByText("Synthetic reply")).toBeInTheDocument();
  });

  it("saves a request by name, lists it under its Pack and sends it with that name", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole("button", chatButton));
    await user.click(screen.getByRole("tab", { name: /Body/ }));
    await user.type(screen.getByRole("textbox", { name: "Body model value" }), "demo-model");
    await user.keyboard("{Meta>}s{/Meta}");
    const name = screen.getByRole("textbox", { name: "Request name" });
    await user.clear(name);
    await user.type(name, "Greeting{Enter}");

    await waitFor(() => expect(api.saveActionRequest).toHaveBeenCalledWith("demo-project", {
      name: "Greeting",
      request: {
        packId: "local.demo.chat",
        file: ".env.local",
        bindings: { GPT_API_KEY: "GPT_API_KEY" },
        body: JSON.stringify({ model: "demo-model" }),
      },
    }));
    expect(await screen.findByRole("heading", { name: "Greeting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Greeting" })).toHaveAttribute("aria-current", "true");

    await user.click(screen.getByRole("button", { name: /^Send/ }));
    await waitFor(() => expect(api.executeActionPack).toHaveBeenLastCalledWith(
      "demo-project",
      expect.objectContaining({ packId: "local.demo.chat" }),
      "Greeting",
    ));
    await user.click(screen.getByRole("tab", { name: /History/ }));
    expect(screen.getByRole("button", { name: /200\s*Greeting/ })).toBeInTheDocument();
  });

  it("validates the raw JSON body against the Pack's allowed fields", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(await screen.findByRole("button", chatButton));
    await user.click(screen.getByRole("tab", { name: /Body/ }));
    await user.click(screen.getByRole("button", { name: "JSON" }));
    const editor = screen.getByRole("textbox", { name: "Request body JSON" });
    await user.clear(editor);
    await user.type(editor, '{{"model":"m","temperature":1}');

    expect(screen.getByRole("alert")).toHaveTextContent("This Pack does not allow one of these fields.");
    expect(screen.getByRole("button", { name: /^Send/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Fields" })).toBeDisabled();
  });
});
