import { test, expect } from "@playwright/test";

const article = {
  _id: "fixture-news-1",
  title: "ព័ត៌មានសេដ្ឋកិច្ចសាកល្បង",
  summary: "សេចក្តីសង្ខេបសម្រាប់សាកល្បងបង្ហាញព័ត៌មានជាភាសាខ្មែរ។",
  body: "អត្ថបទពេញសម្រាប់សាកល្បងប៉ុណ្ណោះ។",
  titleEn: "Example economic update",
  summaryEn: "Authored browser-test content.",
  bodyEn: "This is not a real market event.",
  marketImpactKm: "ព័ត៌មានសាកល្បងអាចប៉ះពាល់ដល់ការរំពឹងទុកទីផ្សារ ប៉ុន្តែមិនបញ្ជាក់ចលនាជាក់លាក់ទេ។",
  category: "សាកល្បង",
  impact: "high",
  source: "Test fixture",
  publishedAt: "2026-10-09T07:00:00.000Z",
};

test("news insight opens by click and fits a mobile viewport", async ({ page }) => {
  await page.route("**/api/news?*", route => route.fulfill({ status: 200, json: [article] }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#news");
  await expect(page.getByRole("heading", { name: "ព័ត៌មានសេដ្ឋកិច្ចសាកល្បង" })).toBeVisible();

  const explanation = page.getByText(article.marketImpactKm);
  await expect(explanation).toBeHidden();
  await page.getByText("ចុចដើម្បីមើលការពន្យល់ពីឥទ្ធិពលទីផ្សារ").click();
  await expect(explanation).toBeVisible();

  await page.getByText("មើលអត្ថបទដើមជាភាសាអង់គ្លេស").click();
  await expect(page.getByText(article.titleEn)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
