import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import * as api from "../lib/api";
import { Markdown } from "./Markdown";

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, readGuideAttachment: vi.fn() };
});

describe("Markdown", () => {
  it("renders headings, lists, code, bold, and links without raw HTML", () => {
    const { container } = render(
      <Markdown
        source={
          "# Get the key\n\n1. Open the console\n2. Copy the key\n\n- **Important**\n- Use `GEMINI_API_KEY`\n\nSee [docs](https://example.com/docs)\n\n<script>alert(1)</script>\n"
        }
      />,
    );

    expect(screen.getByText("Get the key")).toBeInTheDocument();
    expect(screen.getByText("Open the console")).toBeInTheDocument();
    expect(screen.getByText("Important").tagName).toBe("STRONG");
    expect(screen.getByText("GEMINI_API_KEY").tagName).toBe("CODE");
    expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute(
      "href",
      "https://example.com/docs",
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("loads local attachments through the backend instead of the network", async () => {
    vi.mocked(api.readGuideAttachment).mockResolvedValue({
      mimeType: "image/png",
      base64: "ZmFrZXBuZw==",
    });
    render(
      <Markdown
        source={"![Console buttons](attachments/console.png)"}
        projectId="project-1"
        guideKey="GEMINI_API_KEY"
      />,
    );

    const image = (await screen.findByRole("img", { name: "Console buttons" })) as HTMLImageElement;
    expect(image.src).toBe("data:image/png;base64,ZmFrZXBuZw==");
    expect(vi.mocked(api.readGuideAttachment)).toHaveBeenCalledWith(
      "project-1",
      "GEMINI_API_KEY",
      "console.png",
    );
  });

  it("renders remote images as links without fetching them", async () => {
    vi.mocked(api.readGuideAttachment).mockClear();
    render(<Markdown source={"![Remote](https://example.com/a.png)"} projectId="project-1" guideKey="K" />);

    expect(screen.getByRole("link", { name: "Remote" })).toHaveAttribute(
      "href",
      "https://example.com/a.png",
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(vi.mocked(api.readGuideAttachment)).not.toHaveBeenCalled();
  });

  it("shows a placeholder for missing or out-of-scope attachments", async () => {
    vi.mocked(api.readGuideAttachment).mockResolvedValue(null);
    render(
      <Markdown
        source={"![Gone](attachments/gone.png)\n\n![Out](../secret.png)"}
        projectId="project-1"
        guideKey="K"
      />,
    );

    expect(await screen.findByText("Gone")).toBeInTheDocument();
    expect(screen.getByText("Out")).toBeInTheDocument();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
