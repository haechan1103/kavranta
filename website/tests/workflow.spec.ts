import { expect, test } from "@playwright/test";

test("requests update the app, pause holds state, and replay restarts", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install();
  await page.goto("/");
  await page.locator("#demo").scrollIntoViewIfNeeded();
  await page.clock.runFor(100);
  await page.getByRole("button", { name: "데모 처음부터 재생" }).click();
  await expect(page.locator(".animated-variable")).toHaveCount(0);
  await page.clock.runFor(7100);
  await expect(page.locator(".animated-variable")).toContainText("AUTH_SECRET");
  await expect(page.getByRole("status")).toContainText(
    "변경사항이 저장되었습니다",
  );
  await page.getByRole("button", { name: "데모 일시정지" }).click();
  await page.clock.runFor(12000);
  await expect(
    page.getByRole("button", { name: "01변수 설정" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "데모 재생", exact: true }).click();
  await page.getByRole("button", { name: "02파일 연결" }).click();
  await page.clock.runFor(7100);
  await expect(page.locator(".demo-link-detail")).toContainText(
    "2개 파일에 연결됨",
  );
  await page.getByRole("button", { name: "03GitHub 배포" }).click();
  await page.clock.runFor(7100);
  await expect(page.getByRole("status")).toContainText(
    "GitHub staging에 Secret 1개 전송 완료",
  );
  await page.getByRole("button", { name: "데모 일시정지" }).click();
  await page.screenshot({
    path: "test-results/website/desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "데모 처음부터 재생" }).click();
  await expect(page.locator(".animated-variable")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("mobile reduced-motion mode exposes complete scenes without autoplay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:1431"))
      externalRequests.push(request.url());
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "데모 재생", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "변경사항이 저장되었습니다",
  );
  await page.getByRole("button", { name: "03GitHub 배포" }).click();
  await expect(page.getByRole("status")).toContainText(
    "GitHub staging에 Secret 1개 전송 완료",
  );
  await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  await page.screenshot({
    path: "test-results/website/mobile.png",
    fullPage: true,
  });
  await page.getByText("AI가 보호된 값을 전혀 볼 수 없나요?").click();
  await expect(page.locator(".faq-list details[open]")).toContainText(
    "권한 설정과 Guard",
  );
  expect(externalRequests).toEqual([]);
});
