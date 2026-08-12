import { expect, test, type Locator } from "@playwright/test";

async function typeInto(locator: Locator, value: string) {
  await locator.click();
  await locator.pressSequentially(value);
}

test("three-art entry points and mobile layout are reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /八字/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /紫微/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /六爻/ }).first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(overflow).toBe(true);
});

test("guest can export local data without an account", async ({ page }) => {
  await page.goto("/account");
  const exportButton = page.getByRole("button", { name: /导出本机数据/ }).first();
  await expect(exportButton).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/cyber-bazi-local-.*\.json/);
});

test("guest archive delete is local-only and sync actions disclose login requirement", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "bd_list_",
      JSON.stringify([{ profileId: "e2e-profile", name: "E2E", date: "2026-08-12" }]),
    );
    sessionStorage.setItem(
      "bd_profile_e2e-profile",
      JSON.stringify({ id: "e2e-profile", name: "E2E" }),
    );
    sessionStorage.setItem("bd_chart_e2e-profile", JSON.stringify({ profileId: "e2e-profile" }));
  });

  await page.goto("/charts");
  await expect(page.getByText("E2E").first()).toBeVisible();
  await page.getByRole("button", { name: /删除/ }).first().click();
  await expect(page.getByText("E2E").first()).toHaveCount(0);

  await page.goto("/ziwei");
  await expect(page.getByRole("button", { name: /同步到云端/ })).toBeVisible();
  await page.getByRole("button", { name: /同步到云端/ }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("health and anonymous protected write surface are deterministic", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  const response = await request.post("/api/charts", {
    data: { chart: { forged: true } },
    headers: { origin: "http://evil.example" },
  });
  expect([400, 401, 403]).toContain(response.status());
});

test("login entry is usable and anonymous account deletion is refused", async ({
  page,
  request,
}) => {
  await page.goto("/auth/login?callbackUrl=/account");
  await expect(page.locator('input[type="email"][name="email"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "发送登录链接" })).toBeVisible();

  const response = await request.post("/api/account/delete", {
    data: { confirm: "DELETE" },
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(response.status()).toBe(401);
});

test.describe("three-art creation smoke", () => {
  test("Bazi creation reaches the reading page", async ({ page }) => {
    await page.goto("/chart/new");
    await typeInto(page.getByRole("textbox", { name: /姓名/ }), "E2E");
    await page.getByRole("button", { name: "下一步" }).click({ force: true });
    await typeInto(page.locator('input[aria-label="阳历生日"]'), "1990-01-02");
    await page.getByRole("button", { name: "下一步" }).click({ force: true });
    await page.getByRole("checkbox", { name: /时辰未知/ }).check({ force: true });
    await page.getByRole("button", { name: "下一步" }).click({ force: true });
    await page.getByRole("radio", { name: "男" }).click({ force: true });
    await page.getByRole("button", { name: "下一步" }).click({ force: true });
    await page.getByRole("button", { name: "下一步" }).click({ force: true });
    await page.getByRole("button", { name: /确认并开始排盘/ }).click({ force: true });
    await expect(page).toHaveURL(/\/chart\/[^/]+$/);
    const readingHref = await page.locator('a[href$="/reading"]').first().getAttribute("href");
    expect(readingHref).toBeTruthy();
    await page.goto(readingHref!);
    await expect(page).toHaveURL(/\/chart\/[^/]+\/reading$/);
  });

  test("Ziwei creation reaches the reading page", async ({ page }) => {
    await page.goto("/ziwei/new");
    await typeInto(page.getByRole("textbox", { name: /姓名/ }), "E2E");
    await page.getByRole("button", { name: "下一步" }).click({ force: true });
    await typeInto(page.locator('input[aria-label="阳历生日"]'), "1990-01-02");
    await page.getByRole("button", { name: "下一步" }).click({ force: true });
    await page.getByRole("checkbox", { name: /时辰未知/ }).check({ force: true });
    await page.getByRole("button", { name: "下一步" }).click({ force: true });
    await page.getByRole("button", { name: "男" }).click({ force: true });
    await page.getByRole("button", { name: "下一步" }).click({ force: true });
    await page.getByRole("button", { name: /确认并排紫微盘/ }).click({ force: true });
    await expect(page).toHaveURL(/\/ziwei\/[^/]+$/);
    const readingHref = await page.locator('a[href$="/reading"]').first().getAttribute("href");
    expect(readingHref).toBeTruthy();
    await page.goto(readingHref!);
    await expect(page).toHaveURL(/\/ziwei\/[^/]+\/reading$/);
  });

  test("Liuyao creation validates the question before casting", async ({ page }) => {
    await page.goto("/liuyao/new");
    const castButton = page.getByRole("button", { name: "起卦" });
    await expect(castButton).toBeDisabled();
    await typeInto(page.getByRole("textbox", { name: /事项/ }), "E2E 测试事项");
    await expect(castButton).toBeEnabled();
    await castButton.click({ force: true });
    await expect(page).toHaveURL(/\/liuyao\//);
    const readingHref = await page.locator('a[href$="/reading"]').first().getAttribute("href");
    expect(readingHref).toBeTruthy();
    await page.goto(readingHref!);
    await expect(page).toHaveURL(/\/liuyao\/[^/]+\/reading$/);
  });
});
