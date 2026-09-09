import { expect, test } from "@playwright/test";

test("English is the default and language links survive a reload", async ({
  page,
}) => {
  await page.goto("/#try");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Every file you choose.",
  );
  await page.getByRole("button", { name: "한국어", exact: true }).click();
  await expect(page).toHaveURL(/\?lang=ko#try$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  await expect(page).toHaveTitle(/한 번의 편집/);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "직접 고른 파일에.",
  );
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    /Manage the env files/,
  );
  await expect(
    page.getByRole("button", { name: "EN", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("sample updates require selection and preview, and leave production untouched", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:1431"))
      externalRequests.push(request.url());
  });
  await page.goto("/");
  const demo = page.getByRole("region", { name: "Hands-on linking demo" });
  const preview = demo.getByRole("button", { name: "Preview affected files" });
  const production = demo.getByRole("checkbox", { name: "Production" });
  const development = demo.getByRole("checkbox", { name: "Development" });
  await expect(preview).toBeDisabled();
  await expect(production).not.toBeChecked();
  await development.focus();
  await page.keyboard.press("Space");
  await preview.click();
  await expect(demo.locator(".playground-review li")).toHaveText([
    "Local",
    "Development",
  ]);
  await production.check();
  await expect(
    demo.getByRole("button", { name: "Save sample update" }),
  ).toHaveCount(0);
  await preview.click();
  await expect(demo.locator(".playground-review li")).toHaveText([
    "Local",
    "Development",
    "Production",
  ]);
  await production.uncheck();
  await expect(demo.locator(".playground-review")).toHaveCount(0);
  await preview.click();
  await demo.getByRole("button", { name: "Save sample update" }).click();
  await expect(demo.getByRole("status")).toHaveText(
    "Sample update saved to 2 files: Local, Development",
  );
  await expect(
    demo.locator("article").filter({ hasText: "Production" }).locator("header"),
  ).toContainText("Unchanged");
  await expect(
    demo
      .locator("article")
      .filter({ hasText: "Development" })
      .locator("header"),
  ).toContainText("Demo update 1");
  await expect(preview).toBeDisabled();
  await expect(production).toBeDisabled();
  await expect(development).toBeDisabled();
  await demo.getByRole("button", { name: "Reset demo" }).click();
  await expect(development).toBeEnabled();
  await expect(production).not.toBeChecked();
  await expect(development).not.toBeChecked();
  await expect(preview).toBeDisabled();
  await expect(demo.locator("article header span")).toHaveText([
    "Unchanged",
    "Unchanged",
    "Unchanged",
  ]);
  expect(externalRequests).toEqual([]);
});

test("English mobile layout stays within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await expect(
    page.getByRole("button", { name: "EN", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/website/mobile-en.png",
    fullPage: true,
  });
});
