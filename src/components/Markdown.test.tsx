import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "./Markdown";

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
});
