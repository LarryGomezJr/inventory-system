import { expect, test, type Page } from "@playwright/test";
import {
  clearProducts,
  clearSuppliers,
  findProductByName,
  getProductRow,
  seedProducts,
  seedSuppliers,
} from "./helpers/products";
import {
  BASE_URL,
  activityCookie,
  createConfirmedUser,
  deleteUser,
  sessionCookiesFor,
  type TestUser,
} from "./helpers/supabase";

/** Local YYYY-MM-DD, offset by days (same as the app's isoDate). */
function day(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const rowFor = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });
const dataRows = (page: Page) => page.locator("tr[data-product-id]");

async function openAddDialog(page: Page) {
  await page.getByRole("button", { name: "Add product" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add product" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function chooseType(page: Page, type: string) {
  await page.getByRole("combobox", { name: "Type of product" }).click();
  await page.getByRole("option", { name: type, exact: true }).click();
}

async function chooseSupplier(page: Page, name: string | RegExp) {
  const select = page.getByRole("combobox", { name: "Supplier (optional)" });
  await expect(select).toBeEnabled(); // options loaded
  await select.click();
  await page.getByRole("option", { name }).click();
}

test.describe("products", () => {
  let user: TestUser;
  let cookies: Awaited<ReturnType<typeof sessionCookiesFor>>;

  test.beforeAll(async () => {
    user = await createConfirmedUser();
    cookies = await sessionCookiesFor(user);
  });
  test.afterAll(async () => {
    await deleteUser(user?.id);
  });
  test.beforeEach(async ({ context }) => {
    await clearProducts(user.id);
    await clearSuppliers(user.id);
    await context.addCookies(cookies);
  });

  test("Products is in the navigation and shows an empty state", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "sidebar is desktop-only");
    await page.goto("/dashboard");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Products" }).click();
    await expect(page).toHaveURL(/\/dashboard\/products$/);
    await expect(page.getByRole("heading", { name: "Products", level: 1 })).toBeVisible();
    // Next keeps the previous page mounted but hidden, so only look at visible text.
    await expect(page.getByText("No products yet").filter({ visible: true })).toBeVisible();
    await expect(page.getByRole("alert", { name: "Stock alerts" })).toHaveCount(0);
  });

  test("add a product through the modal; it appears in the table", async ({ page }) => {
    const [acme] = await seedSuppliers(user.id, [
      { name: "Acme Trading", category: "Office Supplies" },
      { name: "Zenith Foods", category: "Food & Beverage" },
    ]);
    await page.goto("/dashboard/products");
    const dialog = await openAddDialog(page);

    await dialog.getByLabel("Product name").fill("Printer Ink Black");
    await chooseType(page, "Office Supplies");
    await dialog.getByLabel("Quantity").fill("4");
    await dialog.getByLabel("Reorder level").fill("10");
    await dialog.getByLabel("Expiration date (optional)").fill(day(90));
    await chooseSupplier(page, /^Acme Trading/);
    await dialog.getByRole("button", { name: "Add product" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('"Printer Ink Black" added')).toBeVisible();
    const row = rowFor(page, "Printer Ink Black");
    await expect(row).toBeVisible();
    await expect(row.getByText("Low stock")).toBeVisible();
    await expect(page.getByText("Showing 1–1 of 1")).toBeVisible();

    const db = await findProductByName(user.id, "Printer Ink Black");
    expect(db).toMatchObject({
      user_id: user.id,
      product_type: "Office Supplies",
      quantity: 4,
      reorder_level: 10,
      expiration_date: day(90),
      supplier_id: acme.id,
      stock_status: "low_stock",
    });
  });

  test("the add form validates its fields", async ({ page }) => {
    await page.goto("/dashboard/products");
    const dialog = await openAddDialog(page);
    await dialog.getByLabel("Reorder level").fill("");
    await dialog.getByRole("button", { name: "Add product" }).click();

    await expect(dialog.getByText("Enter the product name")).toBeVisible();
    await expect(dialog.getByText("Choose a product type")).toBeVisible();
    await expect(dialog.getByText("Enter the quantity")).toBeVisible();
    await expect(dialog.getByText("Enter the reorder level")).toBeVisible();

    await dialog.getByLabel("Quantity").fill("-5");
    await dialog.getByRole("button", { name: "Add product" }).click();
    await expect(dialog.getByText("Quantity can't be negative")).toBeVisible();

    await dialog.getByLabel("Quantity").fill("2.5");
    await dialog.getByRole("button", { name: "Add product" }).click();
    await expect(dialog.getByText("Quantity must be a whole number")).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("No products yet")).toBeVisible();
  });

  test("restock and expiry statuses are shown per row", async ({ page }) => {
    await seedProducts(user.id, [
      { name: "Plenty Paper", quantity: 200, reorder_level: 20 },
      { name: "Few Pens", quantity: 3, reorder_level: 5 },
      { name: "No Staples", quantity: 0, reorder_level: 5 },
      { name: "Old Milk", product_type: "Food & Beverage", quantity: 40, expiration_date: day(-3) },
      { name: "Soon Yogurt", product_type: "Food & Beverage", quantity: 40, expiration_date: day(10) },
    ]);
    await page.goto("/dashboard/products");

    await expect(rowFor(page, "Plenty Paper").getByText("In stock")).toBeVisible();
    await expect(rowFor(page, "Few Pens").getByText("Low stock")).toBeVisible();
    await expect(rowFor(page, "No Staples").getByText("Out of stock")).toBeVisible();
    await expect(rowFor(page, "Few Pens").getByText("min 5")).toBeVisible();

    const desktopOnly = test.info().project.name !== "mobile";
    if (desktopOnly) {
      await expect(rowFor(page, "Old Milk").getByText("Expired")).toBeVisible();
      await expect(rowFor(page, "Soon Yogurt").getByText("10d left")).toBeVisible();
    }
  });

  test("low stock alert on top, and 'View low stock' filters the table", async ({ page }) => {
    await seedProducts(user.id, [
      { name: "Plenty Paper", quantity: 200 },
      { name: "Few Pens", quantity: 3, reorder_level: 5 },
      { name: "No Staples", quantity: 0 },
      { name: "Old Milk", quantity: 40, expiration_date: day(-1) },
    ]);
    await page.goto("/dashboard/products");

    const alert = page.getByRole("alert", { name: "Stock alerts" });
    await expect(alert).toBeVisible();
    await expect(alert.getByText("2 products need restocking")).toBeVisible();
    await expect(alert.getByText("1 out of stock")).toBeVisible();
    await expect(alert.getByText("1 running low")).toBeVisible();
    await expect(alert.getByText("No Staples — out of stock")).toBeVisible();
    await expect(alert.getByText("Few Pens — 3 left")).toBeVisible();
    await expect(alert.getByText("1 expired")).toBeVisible();

    // The alert sits above the table.
    const alertBox = await alert.boundingBox();
    const tableBox = await page.getByRole("table", { name: "Products" }).boundingBox();
    expect(alertBox!.y).toBeLessThan(tableBox!.y);

    await alert.getByRole("button", { name: "View low stock" }).click();
    await expect(page).toHaveURL(/status=low_stock/);
    await expect(dataRows(page)).toHaveCount(2);
    await expect(rowFor(page, "Plenty Paper")).toHaveCount(0);

    await alert.getByRole("button", { name: "View expiring" }).click();
    await expect(page).toHaveURL(/status=expiring/);
    await expect(dataRows(page)).toHaveCount(1);
    await expect(rowFor(page, "Old Milk")).toBeVisible();
  });

  test("edit a product; status and alert update", async ({ page }) => {
    await seedProducts(user.id, [{ name: "Few Pens", quantity: 2, reorder_level: 10, supplier: "Old Supplier" }]);
    await page.goto("/dashboard/products");
    await expect(page.getByRole("alert", { name: "Stock alerts" })).toBeVisible();

    await page.getByRole("button", { name: "Edit Few Pens" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit product" });
    await expect(dialog.getByLabel("Product name")).toHaveValue("Few Pens");
    await expect(dialog.getByLabel("Quantity")).toHaveValue("2");

    await dialog.getByLabel("Product name").fill("Blue Pens");
    await dialog.getByLabel("Quantity").fill("25");
    await expect(dialog.getByRole("combobox", { name: "Supplier (optional)" })).toContainText("Old Supplier");
    await chooseSupplier(page, "No supplier");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText('"Blue Pens" updated')).toBeVisible();
    const row = rowFor(page, "Blue Pens");
    await expect(row.getByText("In stock")).toBeVisible();
    await expect(rowFor(page, "Few Pens")).toHaveCount(0);
    await expect(page.getByRole("alert", { name: "Stock alerts" })).toHaveCount(0);

    const db = await findProductByName(user.id, "Blue Pens");
    expect(db).toMatchObject({ quantity: 25, supplier_id: null, stock_status: "in_stock" });
  });

  test("delete asks for confirmation; cancel keeps, confirm removes", async ({ page }) => {
    const [seeded] = await seedProducts(user.id, [{ name: "Old Stapler" }]);
    await page.goto("/dashboard/products");

    await page.getByRole("button", { name: "Delete Old Stapler" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText('Delete “Old Stapler”?')).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(rowFor(page, "Old Stapler")).toBeVisible();

    await page.getByRole("button", { name: "Delete Old Stapler" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText('"Old Stapler" deleted')).toBeVisible();
    await expect(page.getByText("No products yet")).toBeVisible();
    expect(await getProductRow(seeded.id)).toBeNull();
  });

  test("search by name, type or supplier; empty result; query kept in the URL", async ({ page }) => {
    await seedProducts(user.id, [
      { name: "Alpha Widget", supplier: "Northwind", product_type: "Hardware" },
      { name: "Beta Gadget", supplier: "Contoso", product_type: "Electronics" },
      { name: "Gamma Cleaner", supplier: "Fabrikam", product_type: "Cleaning Supplies" },
    ]);
    await page.goto("/dashboard/products");
    await expect(dataRows(page)).toHaveCount(3);
    const search = page.getByRole("searchbox", { name: "Search products" });

    await search.fill("alpha");
    await expect(page).toHaveURL(/q=alpha/);
    await expect(dataRows(page)).toHaveCount(1);
    await expect(rowFor(page, "Alpha Widget")).toBeVisible();

    await search.fill("contoso");
    await expect(dataRows(page)).toHaveCount(1);
    await expect(rowFor(page, "Beta Gadget")).toBeVisible();

    await search.fill("cleaning");
    await expect(dataRows(page)).toHaveCount(1);
    await expect(rowFor(page, "Gamma Cleaner")).toBeVisible();

    // Characters that are special in SQL LIKE / PostgREST are handled safely.
    await search.fill("100%,(x)");
    await expect(page.getByText(/No products match/)).toBeVisible();

    await search.fill("zzz");
    await expect(page.getByText("No products match “zzz”")).toBeVisible();

    // Reloading keeps the search.
    await page.reload();
    await expect(page.getByRole("searchbox", { name: "Search products" })).toHaveValue("zzz");
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(dataRows(page)).toHaveCount(3);
  });

  test("pagination: 10 per page across 3 pages", async ({ page }) => {
    await seedProducts(
      user.id,
      Array.from({ length: 23 }, (_, i) => ({ name: `Item ${String(i + 1).padStart(2, "0")}` })),
    );
    await page.goto("/dashboard/products");

    await expect(dataRows(page)).toHaveCount(10);
    await expect(page.getByText("Showing 1–10 of 23")).toBeVisible();
    await expect(dataRows(page).first()).toContainText("Item 23"); // newest first

    await page.getByRole("link", { name: "Go to next page" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText("Showing 11–20 of 23")).toBeVisible();
    await expect(dataRows(page).first()).toContainText("Item 13");

    await page.getByRole("link", { name: "Go to next page" }).click();
    await expect(page.getByText("Showing 21–23 of 23")).toBeVisible();
    await expect(dataRows(page)).toHaveCount(3);
    await expect(page.getByRole("link", { name: "Go to next page" })).toHaveAttribute("aria-disabled", "true");

    await page.getByRole("link", { name: "Go to previous page" }).click();
    await expect(page.getByText("Showing 11–20 of 23")).toBeVisible();

    // Search resets to page 1.
    await page.getByRole("searchbox", { name: "Search products" }).fill("Item 0");
    await expect(page.getByText("Showing 1–9 of 9")).toBeVisible();
    await expect(page).not.toHaveURL(/page=/);
  });

  test("users only see and change their own products", async ({ page }) => {
    const other = await createConfirmedUser();
    try {
      const [theirs] = await seedProducts(other.id, [{ name: "Someone Else's Secret Item" }]);
      await seedProducts(user.id, [{ name: "My Own Item" }]);

      await page.goto("/dashboard/products");
      await expect(rowFor(page, "My Own Item")).toBeVisible();
      await expect(page.getByText("Someone Else's Secret Item")).toHaveCount(0);

      const patch = await page.request.patch(`/api/products/${theirs.id}`, {
        data: { name: "Hacked", productType: "Other", quantity: 1, reorderLevel: 1 },
      });
      expect(patch.status()).toBe(404);
      const del = await page.request.delete(`/api/products/${theirs.id}`);
      expect(del.status()).toBe(404);
      expect(await getProductRow(theirs.id)).toMatchObject({ name: "Someone Else's Secret Item" });

      // A user_id smuggled into the body is ignored.
      const created = await page.request.post("/api/products", {
        data: { name: "Sneaky", productType: "Other", quantity: 1, reorderLevel: 1, user_id: other.id },
      });
      expect(created.status()).toBe(201);
      const row = await getProductRow((await created.json()).product.id);
      expect(row?.user_id).toBe(user.id);
    } finally {
      await deleteUser(other.id);
    }
  });

  test("products API rejects bad input and missing or idle sessions", async ({ page, playwright }) => {
    const bad = await page.request.post("/api/products", {
      data: { name: "", productType: "Nope", quantity: -1, reorderLevel: "x", expirationDate: "2026-02-30" },
    });
    expect(bad.status()).toBe(400);
    const body = await bad.json();
    expect(Object.keys(body.fieldErrors).sort()).toEqual(
      ["expirationDate", "name", "productType", "quantity", "reorderLevel"].sort(),
    );

    const anon = await playwright.request.newContext({ baseURL: BASE_URL });
    for (const res of [
      await anon.get("/api/products"),
      await anon.post("/api/products", { data: {} }),
      await anon.delete("/api/products/00000000-0000-0000-0000-000000000000"),
    ]) {
      expect(res.status()).toBe(401);
      expect((await res.json()).code).toBe("SESSION_EXPIRED");
    }
    await anon.dispose();

    // A separate session, idle for 31 minutes (don't sign out the shared one).
    const idle = await playwright.request.newContext({ baseURL: BASE_URL });
    const fresh = await sessionCookiesFor(user);
    const cookieHeader = [
      ...fresh.filter((c) => c.name !== "session_activity"),
      activityCookie(user.id, Date.now() - 31 * 60 * 1000),
    ]
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const res = await idle.get("/api/products", { headers: { cookie: cookieHeader } });
    expect(res.status()).toBe(401);
    expect((await res.json()).code).toBe("SESSION_EXPIRED");
    await idle.dispose();
  });

  test("@mobile layout fits the screen and the modal is usable", async ({ page }) => {
    await seedProducts(user.id, [
      { name: "A very long product name that should wrap nicely on small screens", quantity: 2, supplier: "Long Supplier Name Inc." },
      { name: "Short", quantity: 100, expiration_date: day(5) },
    ]);
    await page.goto("/dashboard/products");
    await expect(dataRows(page)).toHaveCount(2);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    // Row actions are fully on screen (a single menu on phones, two buttons from sm up).
    const isPhone = page.viewportSize()!.width < 640;
    if (isPhone) {
      const trigger = page.getByRole("button", { name: "Actions for Short" });
      await expect(trigger).toBeInViewport({ ratio: 1 });
      await trigger.click();
      await expect(page.getByRole("menuitem", { name: "Edit" })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("menuitem", { name: "Delete" })).toBeInViewport({ ratio: 1 });
      await page.getByRole("menuitem", { name: "Edit" }).click();
      await expect(page.getByRole("dialog", { name: "Edit product" }).getByLabel("Product name")).toHaveValue("Short");
      await page.keyboard.press("Escape");
    } else {
      await expect(page.getByRole("button", { name: "Edit Short" })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("button", { name: "Delete Short" })).toBeInViewport({ ratio: 1 });
    }

    const dialog = await openAddDialog(page);
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    await expect(dialog.getByRole("button", { name: "Add product" })).toBeVisible();
  });
});
