import { expect, test } from "@playwright/test";

test("shows a compact copy confirmation without moving or revealing the row", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Find a variable" })
    .fill("GPT_API_KEY");
  await page
    .getByRole("region", { name: "Find a variable" })
    .getByRole("button")
    .first()
    .click();
  await page.getByLabel("Language").selectOption("ko");

  const keyButton = page.getByRole("button", {
    name: "GPT_API_KEY 환경변수명 복사",
  });
  const row = page.locator(".variable-row").filter({ has: keyButton });
  const valueButton = row.getByRole("button", { name: "값 복사", exact: true });
  const before = await row.boundingBox();
  await valueButton.click();
  const feedback = row.getByRole("status");
  await expect(feedback).toHaveText("복사 완료");
  await expect(row.locator("input[type=password]")).toHaveValue("");
  expect(await row.boundingBox()).toEqual(before);

  const feedbackBox = await feedback.boundingBox();
  const groupBox = await page
    .locator(".group-card")
    .filter({ has: row })
    .boundingBox();
  expect(feedbackBox).not.toBeNull();
  expect(groupBox).not.toBeNull();
  expect(feedbackBox!.y).toBeGreaterThanOrEqual(groupBox!.y);
  expect(feedbackBox!.x).toBeGreaterThanOrEqual(groupBox!.x);
  expect(feedbackBox!.x + feedbackBox!.width).toBeLessThanOrEqual(
    groupBox!.x + groupBox!.width,
  );
  await page.screenshot({
    path: "test-results/kavranta-copy-value.png",
    fullPage: true,
  });
  await expect(feedback).toHaveCount(0);

  await keyButton.focus();
  await page.keyboard.press("Enter");
  await expect(row.getByRole("status")).toHaveText("복사 완료");
  expect(await row.boundingBox()).toEqual(before);
  await page.screenshot({
    path: "test-results/kavranta-copy-key.png",
    fullPage: true,
  });
  await expect(row.getByRole("status")).toHaveCount(0);
});
