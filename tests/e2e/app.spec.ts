import { expect, test } from "@playwright/test";

test("keeps project selection compact in the sidebar", async ({ page }) => {
  await page.goto("/");

  const sidebar = page.locator(".sidebar");
  await expect(sidebar.getByText("sample-saas", { exact: true })).toBeVisible();
  await expect(sidebar.getByText("PROJECTS", { exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: "Access review" })).toHaveCount(0);
  await expect(sidebar.getByLabel("Current project")).not.toContainText("Project actions");
  const projectActions = sidebar
    .getByRole("navigation", { name: "Project views" })
    .getByRole("button", { name: "Project actions" });
  await expect(projectActions).toBeVisible();
  await projectActions.click();
  const actionMenu = page.getByRole("menu");
  const [triggerBox, menuBox] = await Promise.all([
    projectActions.boundingBox(),
    actionMenu.boundingBox(),
  ]);
  expect(triggerBox).not.toBeNull();
  expect(menuBox).not.toBeNull();
  expect(menuBox!.x).toBeGreaterThan(triggerBox!.x + triggerBox!.width);
  await page.screenshot({
    path: "test-results/kavranta-project-actions.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await sidebar.getByRole("button", { name: "Change" }).click();

  const dialog = page.getByRole("dialog", { name: "Switch project" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Switch project" })).toHaveCSS("color", "rgb(23, 32, 29)");
  await expect(dialog.getByText("/Users/demo/dev/sample-saas")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Add project" })).toBeVisible();
});

test("navigates the redacted V1 workflow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Action inbox")).toBeVisible();
  await expect(page.getByText("NEXT_PUBLIC_APP_URL")).toBeVisible();
  await expect(page.getByText("fake_preview_value")).toHaveCount(0);

  const fileActions = page.getByRole("button", { name: "Actions for Local environment" });
  await fileActions.click();
  await page.getByRole("menuitem", { name: /Change display name/ }).click();
  await expect(page.getByText(/file on disk remains/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await fileActions.click();
  await page.getByRole("menuitem", { name: /Rename actual file/ }).click();
  await expect(page.getByText(/References in source code/)).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await page
    .getByRole("button", { name: /Local environment.*\.env\.local/ })
    .click();
  await expect(page.getByRole("heading", { name: "Local environment" })).toBeVisible();
  await expect(page.getByRole("main").getByText(".env.local", { exact: true }).first()).toBeVisible();
  const apiKeyInput = page.getByLabel("GPT_API_KEY value");
  await expect(page.getByText("Managed together in 2 files")).toBeVisible();
  await expect(page.getByRole("main").getByText(".env.development")).toBeVisible();
  await page.getByTitle("Show value · hides after 30 seconds of inactivity").first().click();
  await expect(page.locator("textarea.revealed-value-field")).toBeVisible();
  await apiKeyInput.fill("fake_e2e_replacement");
  await expect(page.getByRole("button", { name: "Save to 2 files" })).toBeVisible();
  await page.screenshot({
    path: "test-results/kavranta-file-editor.png",
    fullPage: true,
  });

  await expect(page.getByRole("button", { name: "Effective value" })).toHaveCount(0);
});

test("shows a compact product-style empty project screen", async ({ page }) => {
  await page.goto("/?empty=1");

  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Choose a project folder" }),
  ).toBeVisible();
  await expect(page.getByText("Environment variables stay where they are")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Choose folder…" })).toBeVisible();
  await expect(page.getByText(".env.example")).toBeVisible();

  await page.screenshot({
    path: "test-results/kavranta-empty-project.png",
    fullPage: true,
  });
});

test("shows one shared integration bundle for supported AI tools", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "AI tool connections" }).click();
  await expect(page.getByText("Codex", { exact: true })).toBeVisible();
  await expect(page.getByText("Claude Code", { exact: true })).toBeVisible();
  await expect(page.getByText("GitHub Copilot / VS Code", { exact: true })).toBeVisible();
  await expect(page.getByText("Cursor", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connect the same rules to every tool you use" })).toBeVisible();
  await expect(page.getByText(/API_KEY=/)).toHaveCount(0);

  await page.screenshot({
    path: "test-results/kavranta-ai-integrations.png",
    fullPage: true,
  });
});

test("persists an explicit Korean language selection", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Items to review" })).toBeVisible();
  await page.getByLabel("Language").selectOption("ko");
  await expect(page.getByRole("heading", { name: "지금 확인할 항목" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "지금 확인할 항목" })).toBeVisible();
  await expect(page.getByLabel("언어")).toHaveValue("ko");
});

test("offers four persistent text-size levels with the current size as small", async ({ page }) => {
  await page.goto("/");

  const control = page.getByLabel("Text size");
  await expect(control).toHaveValue("small");
  await expect(control.locator("option")).toHaveText(["Small", "Medium", "Large", "Extra large"]);

  const smallFontSize = await page.locator(".brand").evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  );
  await control.selectOption("extra-large");
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "extra-large");
  const extraLargeFontSize = await page.locator(".brand").evaluate((element) =>
    Number.parseFloat(window.getComputedStyle(element).fontSize),
  );
  expect(extraLargeFontSize).toBeGreaterThan(smallFontSize);
  await page.screenshot({
    path: "test-results/kavranta-extra-large-text.png",
    fullPage: true,
  });

  await page.reload();
  await expect(page.getByLabel("Text size")).toHaveValue("extra-large");
  await expect(page.locator("html")).toHaveAttribute("data-font-size", "extra-large");

  await page.setViewportSize({ width: 920, height: 620 });
  const horizontalOverflow = await page.locator(".main-panel").evaluate(
    (element) => element.scrollWidth - element.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: "Project actions" }).click();
  const projectRemovalAction = page.getByRole("menuitem", { name: "Remove registration" });
  await expect(projectRemovalAction).toBeVisible();
  const projectRemovalActionBox = await projectRemovalAction.boundingBox();
  expect(projectRemovalActionBox).not.toBeNull();
  expect(projectRemovalActionBox!.x + projectRemovalActionBox!.width).toBeLessThanOrEqual(920);
  await page.screenshot({
    path: "test-results/kavranta-extra-large-text-min-window.png",
    fullPage: true,
  });
});

test("offers complete and variable-level env sharing", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Project actions" }).click();
  await page.getByRole("menuitem", { name: "Export" }).click();
  await expect(page.getByRole("heading", { name: "Export env files" })).toBeVisible();
  await expect(page.getByText("Share everything")).toBeVisible();
  await page.getByText("Choose what to share").click();
  await expect(page.getByText("GPT_API_KEY").first()).toBeVisible();
  await expect(page.getByText("Selects 2 linked files together").first()).toBeVisible();
  await expect(page.getByText("fake_preview_value")).toHaveCount(0);
});

test("reviews encrypted-share conflicts individually before applying", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Project actions" }).click();
  await page.getByRole("menuitem", { name: "Import share" }).click();
  await page.getByLabel("Share passphrase").fill("fake-team-passphrase-2026");
  await page.getByRole("button", { name: "Choose encrypted file" }).click();

  await expect(page.getByText("Choose where each file goes")).toBeVisible();
  await expect(page.getByText("Linked across 2 files")).toBeVisible();
  await expect(page.getByText("Use received 0")).toBeVisible();
  await expect(page.getByText("fake_local_value")).toHaveCount(0);

  const publicConflict = page.locator(".import-conflict-card").filter({ hasText: "VITE_API_BASE_URL" });
  await publicConflict.getByRole("button", { name: "Reveal my local value" }).click();
  await expect(publicConflict.getByText("fake_local_value")).toBeVisible();
  await publicConflict.getByRole("button", { name: "Use shared" }).click();
  await expect(page.getByText("Use received 1")).toBeVisible();

  await publicConflict.getByRole("button", { name: "Hide value" }).click();
  const webTarget = page.getByLabel("Target file for apps/web/.env.local");
  await webTarget.fill("apps/web/.env.staging");
  await webTarget.locator("..").getByRole("button", { name: "Change" }).click();
  await expect(webTarget).toHaveValue("apps/web/.env.staging");
  await expect(page.locator(".import-summary .conflict strong")).toHaveText("2");

  await page.getByRole("button", { name: "Use all shared" }).click();
  await expect(page.getByText("Use received 2")).toBeVisible();
  await expect(page.getByText("fake_local_value")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/kavranta-import-conflicts.png",
    fullPage: true,
  });
});
