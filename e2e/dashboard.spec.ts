import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { clearProducts, seedProducts } from "./helpers/products";
import { createConfirmedUser, deleteUser, sessionCookiesFor, type TestUser } from "./helpers/supabase";

function day(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Loads a page and fails if the dev server logged any error while rendering it. */
async function expectNoServerErrors(page: Page, url: string, ready: () => Promise<void>) {
  // The dev server writes render errors (e.g. prerender violations) here,
  // which never reach the browser console.
  const log = path.join(process.cwd(), ".next", "dev", "logs", "next-development.log");
  test.skip(!fs.existsSync(log), "Only available against `next dev`");

  const start = fs.statSync(log).size;
  await page.goto(url);
  await ready();
  await page.waitForTimeout(1500); // let the server finish logging

  const fd = fs.openSync(log, "r");
  const buf = Buffer.alloc(fs.statSync(log).size - start);
  fs.readSync(fd, buf, 0, buf.length, start);
  fs.closeSync(fd);
  const errors = buf
    .toString("utf8")
    .split("\n")
    .filter((line) => line.includes('"level":"ERROR"'));
  expect(errors, errors.join("\n")).toEqual([]);
}

// Streamed content is in the DOM (hidden) before React reveals it, so only match visible stats.
const stat = (page: Page, label: string) => page.locator(`[data-stat="${label}"]`).filter({ visible: true });

test.describe("dashboard home", () => {
  let user: TestUser;
  let cookies: Awaited<ReturnType<typeof sessionCookiesFor>>;
  test.beforeAll(async () => {
    user = await createConfirmedUser();
    // One session shared by these tests (keeps Supabase auth calls low).
    cookies = await sessionCookiesFor(user);
  });
  test.afterAll(async () => {
    await deleteUser(user?.id);
  });

  test.beforeEach(async ({ context }) => {
    await clearProducts(user.id);
    await context.addCookies(cookies);
  });

  test("empty inventory shows zeros and a link to add products", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Welcome back, Test" })).toBeVisible();
    await expect(stat(page, "Total products")).toHaveText("0");
    await expect(page.getByRole("link", { name: "Add your first product" })).toBeVisible();
    await expect(page.getByText("All products are above their reorder level.")).toBeVisible();
    await expect(page).toHaveTitle("Dashboard · Inventory System");
  });

  test("stat cards, recently added and low stock lists use real data", async ({ page }) => {
    await seedProducts(user.id, [
      { name: "Plenty Paper", quantity: 200 },
      { name: "Few Pens", quantity: 3, reorder_level: 5 },
      { name: "No Staples", quantity: 0 },
      { name: "Soon Yogurt", product_type: "Food & Beverage", quantity: 40, expiration_date: day(7) },
      { name: "Old Milk", product_type: "Food & Beverage", quantity: 40, expiration_date: day(-2) },
      { name: "Newest Item", quantity: 99 },
    ]);
    await page.goto("/dashboard");

    await expect(stat(page, "Total products")).toHaveText("6");
    await expect(stat(page, "Low stock")).toHaveText("1");
    await expect(stat(page, "Out of stock")).toHaveText("1");
    await expect(stat(page, "Expiring in 30 days")).toHaveText("1");
    await expect(page.getByText("1 already expired")).toBeVisible();

    const recent = page.getByRole("table", { name: "Recently added products" });
    await expect(recent.getByRole("row")).toHaveCount(6); // header + latest 5
    await expect(recent.getByRole("row").nth(1)).toContainText("Newest Item");
    await expect(recent.getByText("Plenty Paper")).toHaveCount(0); // oldest, not in top 5

    const low = page.getByRole("list", { name: "Low stock products" });
    await expect(low.getByRole("listitem")).toHaveCount(2);
    await expect(low.getByRole("listitem").first()).toContainText("No Staples");
    await expect(low.getByText("3 / 5")).toBeVisible();
  });

  test("stat cards link to the filtered products table", async ({ page }) => {
    await seedProducts(user.id, [{ name: "No Staples", quantity: 0 }, { name: "Plenty", quantity: 100 }]);
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /Out of stock/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/products\?status=out_of_stock$/);
    await expect(page.locator("tr[data-product-id]")).toHaveCount(1);
  });

  test("navigation: Dashboard is active, Products and Suppliers are enabled, the rest are Soon", async ({ page }, testInfo) => {
    await page.goto("/dashboard");
    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("menu");
      await expect(menu.getByRole("menuitem", { name: "Dashboard" })).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Products" })).not.toHaveAttribute("data-disabled");
      await expect(menu.getByRole("menuitem", { name: /Categories/ })).toHaveAttribute("data-disabled", "");
      await expect(menu.getByRole("menuitem", { name: "Suppliers" })).not.toHaveAttribute("data-disabled");
      await menu.getByRole("menuitem", { name: "Products" }).click();
      await expect(page).toHaveURL(/\/dashboard\/products$/);
    } else {
      const nav = page.getByRole("navigation", { name: "Main" });
      await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
      await expect(nav.getByRole("link", { name: "Products" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Suppliers" })).toBeVisible();
      for (const item of ["Categories", "Stock movements", "Reports"]) {
        await expect(nav.getByText(item)).toBeVisible();
      }
      await expect(nav.getByText("Soon")).toHaveCount(3);
    }
  });

  test("dashboard and products render without server errors", async ({ page }) => {
    await seedProducts(user.id, [{ name: "Soon Yogurt", quantity: 2, expiration_date: day(3) }]);
    await expectNoServerErrors(page, "/dashboard", () =>
      expect(stat(page, "Total products")).toHaveText("1"),
    );
    await expectNoServerErrors(page, "/dashboard/products", () =>
      expect(page.locator("tr[data-product-id]")).toHaveCount(1),
    );
  });

  test("layout has no horizontal scroll", async ({ page }) => {
    await seedProducts(user.id, [
      { name: "A really quite long product name to test wrapping on phones", quantity: 1, expiration_date: day(4) },
    ]);
    for (const url of ["/dashboard", "/dashboard/products"]) {
      await page.goto(url);
      await expect(page.getByText("A really quite long product name to test wrapping on phones").first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, url).toBeLessThanOrEqual(0);
    }
  });
});
