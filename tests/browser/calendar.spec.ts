import { test, expect } from "@playwright/test";
import { calendarPresets } from "../../lib/calendar/dates";
test("public demo calendar filters, English toggle, date validation, and refresh", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByText("DEMO MODE")).toBeVisible();
  await expect(page.getByTestId("event-row")).toHaveCount(6);
  await expect(page.getByLabel("បង្ហាញឈ្មោះអង់គ្លេស")).toBeChecked();
  await page
    .getByRole("combobox", { name: "រូបិយប័ណ្ណ", exact: true })
    .selectOption("USD");
  await expect(page.getByTestId("event-row")).toHaveCount(1);
  await page.getByLabel("បង្ហាញឈ្មោះអង់គ្លេស").check();
  await expect(
    page.getByText("Consumer Price Index", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "ប្រទេស", exact: true })
    .selectOption("Canada");
  await expect(page.getByTestId("empty-state")).toBeVisible();
  await page.getByTestId("text-button").click();
  await expect(page.getByTestId("event-row")).toHaveCount(6);
  await page
    .getByRole("combobox", { name: "កម្រិតឥទ្ធិពល", exact: true })
    .selectOption("high");
  await expect(page.getByTestId("event-row")).toHaveCount(3);
  await page.getByRole("button", { name: "៧ ថ្ងៃបន្ទាប់" }).click();
  await expect(page.getByTestId("event-row")).toHaveCount(21);
  await page
    .getByRole("button", { name: "ធ្វើបច្ចុប្បន្នភាព", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "ធ្វើបច្ចុប្បន្នភាព", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("ចាប់ពីថ្ងៃ", { exact: true }).fill("2026-12-31");
  await page.getByLabel("ដល់ថ្ងៃ", { exact: true }).fill("2026-01-01");
  await expect(
    page
      .getByRole("region", { name: "ប្រតិទិនព្រឹត្តិការណ៍", exact: true })
      .getByRole("alert"),
  ).toBeVisible();
  expect((await request.post("/api/calendar/sync")).status()).toBe(401);
  expect((await request.get("/api/calendar?impact=invalid")).status()).toBe(
    400,
  );
});
test("mobile layout fits viewport and calendar remains scrollable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("event-row")).toHaveCount(6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  const table = page.getByTestId("table-scroll");
  expect(
    await table.evaluate(
      (element) => element.scrollWidth > element.clientWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: "artifacts/calendar-mobile.png",
    fullPage: true,
  });
});
test("event disclosure explains AI and released-value support requirements in demo mode", async ({ page }) => {
  await page.goto("/");
  const event = page.getByTestId("event-row").first();
  await event.locator("button[aria-haspopup='dialog']").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/ការពន្យល់ AI នឹងបង្ហាញ/)).toBeVisible();
  await expect(page.locator("#guide")).toContainText("ការរំពឹងជាមធ្យមមុនពេលចេញផ្សាយ");
  await expect(page.locator("#guide")).toContainText("ទិន្ន័យបច្ចុប្បន្ន ជាមួយ ការព្យាករណ៍");
  await page.getByRole("button", { name: "បិទការពន្យល់" }).click();
  await expect(dialog).not.toBeVisible();
});
test("loading, source error, retry and stale data states are visible", async ({
  page,
}) => {
  let resolveRequest!: () => void;
  const pending = new Promise<void>((resolve) => {
    resolveRequest = resolve;
  });
  await page.route("**/api/calendar?*", async (route) => {
    await pending;
    await route.fulfill({
      status: 503,
      json: { error: "CALENDAR_UNAVAILABLE" },
    });
  });
  await page.goto("/");
  await expect(page.getByTestId("loading-state")).toBeVisible();
  resolveRequest();
  await expect(
    page
      .getByRole("region", { name: "ប្រតិទិនព្រឹត្តិការណ៍", exact: true })
      .getByRole("alert"),
  ).toBeVisible();
  await page.unroute("**/api/calendar?*");
  await page.getByRole("button", { name: "ព្យាយាមម្តងទៀត" }).click();
  await expect(page.getByTestId("event-row")).toHaveCount(6);
  await page.route("**/api/calendar?*", (route) =>
    route.fulfill({ status: 503, json: { error: "CALENDAR_UNAVAILABLE" } }),
  );
  await page
    .getByRole("button", { name: "ធ្វើបច្ចុប្បន្នភាព", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "ប្រតិទិនព្រឹត្តិការណ៍", exact: true })
      .getByRole("alert"),
  ).toBeVisible();
  await expect(page.getByTestId("event-row")).toHaveCount(6);
});
test("desktop calendar screenshot", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1512, height: 1000 });
  await page.goto("/");
  await expect(page.getByTestId("event-row")).toHaveCount(6);
  await expect(page.getByTestId("today-card")).toContainText("ថ្ងៃ");
  await page.screenshot({
    path: "artifacts/calendar-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("visible calendar automatically checks the cache after 60 seconds", async ({
  page,
}) => {
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByTestId("event-row")).toHaveCount(6);
  const response = page.waitForResponse((response) =>
    response.url().includes("/api/calendar?"),
  );
  await page.clock.fastForward(60_000);
  expect((await response).status()).toBe(200);
});

test("historical shortcuts update dates and request the selected range", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("event-row")).toHaveCount(6);
  const today = await page.getByLabel("ចាប់ពីថ្ងៃ", { exact: true }).inputValue();
  for (const preset of calendarPresets(today).filter(item => ['yesterday', 'last-week', 'last-month'].includes(item.id))) {
    const response = page.waitForResponse(response => {
      const url = new URL(response.url());
      return url.pathname === '/api/calendar' && url.searchParams.get('from') === preset.from && url.searchParams.get('to') === preset.to;
    });
    const button = page.getByRole('button', { name: preset.label, exact: true });
    await button.click();
    expect((await response).status()).toBe(200);
    await expect(page.getByLabel("ចាប់ពីថ្ងៃ", { exact: true })).toHaveValue(preset.from);
    await expect(page.getByLabel("ដល់ថ្ងៃ", { exact: true })).toHaveValue(preset.to);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
});
