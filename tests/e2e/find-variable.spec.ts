import { expect, test } from "@playwright/test";

test("opens the next missing variable with a focused file filter", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Fill the next missing value" })
    .click();
  await expect(
    page.getByRole("searchbox", {
      name: "Find by name, group, or description",
    }),
  ).toHaveValue("NEXT_PUBLIC_APP_URL");
  await expect(page.getByLabel("NEXT_PUBLIC_APP_URL value")).toBeVisible();
  await expect(page.getByLabel("GPT_API_KEY value")).not.toBeVisible();
});

test("searches a project then keeps drafts when file filters change", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Find a variable" })
    .fill("GPT_API_KEY");
  const matches = page
    .getByRole("region", { name: "Find a variable" })
    .getByRole("button");
  await expect(matches).toHaveCount(2);
  await page.screenshot({
    path: "test-results/kavranta-variable-finder.png",
    fullPage: true,
  });
  await matches.first().click();
  const search = page.getByRole("searchbox", {
    name: "Find by name, group, or description",
  });
  await expect(search).toHaveValue("GPT_API_KEY");
  const value = page.getByLabel("GPT_API_KEY value");
  await value.fill("fake_search_draft");
  await search.fill("NEXT_PUBLIC_APP_URL");
  await expect(value).not.toBeVisible();
  await search.fill("GPT_API_KEY");
  await expect(value).toHaveValue("fake_search_draft");
  await expect(
    page.getByRole("button", { name: "Save to 2 files" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/kavranta-filtered-editor.png",
    fullPage: true,
  });
});
