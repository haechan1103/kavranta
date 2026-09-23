import { expect, test } from "@playwright/test";

test("shows the agent-readable exposure scan without leaking values", async ({ page }) => {
  await page.goto("/");

  const sidebar = page.locator(".sidebar");
  await sidebar.getByRole("button", { name: "Exposure" }).click();

  await expect(page.getByRole("heading", { name: "What an agent could read" })).toBeVisible();
  await expect(page.getByText("credentials.json")).toBeVisible();
  await expect(page.getByText("apps/web/.npmrc")).toBeVisible();
  await expect(page.getByText("AI-allowed variable")).toBeVisible();
  await expect(page.getByText("Agent-readable exposed files: 4")).toBeVisible();
  await expect(page.locator(".exposure-page")).not.toContainText("fake_");

  await page.screenshot({
    path: "test-results/kavranta-exposure-scan.png",
    fullPage: true,
  });
});
