import { expect, test, type Page } from "@playwright/test";
import {
  clearProducts,
  clearSuppliers,
  findSupplierByName,
  getProductRow,
  getSupplierRow,
  seedProducts,
  seedSuppliers,
} from "./helpers/products";
import { createConfirmedUser, deleteUser, sessionCookiesFor, type TestUser } from "./helpers/supabase";

const rowFor = (page: Page, name: string) => page.locator("tr[data-supplier-id]").filter({ hasText: name });
const dataRows = (page: Page) => page.locator("tr[data-supplier-id]");

async function openAddDialog(page: Page) {
  await page.getByRole("button", { name: "Add supplier" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add supplier" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function chooseCategory(page: Page, category: string) {
  await page.getByRole("combobox", { name: "Category" }).click();
  await page.getByRole("option", { name: category, exact: true }).click();
}

test.describe("suppliers", () => {
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

  test("Suppliers is in the navigation and shows an empty state", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "sidebar is desktop-only");
    await page.goto("/dashboard");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Suppliers" }).click();
    await expect(page).toHaveURL(/\/dashboard\/suppliers$/);
    await expect(page.getByRole("heading", { name: "Suppliers", level: 1 })).toBeVisible();
    await expect(page.getByText("No suppliers yet").filter({ visible: true })).toBeVisible();
  });

  test("add a supplier with all details; it appears in the table", async ({ page }) => {
    await page.goto("/dashboard/suppliers");
    const dialog = await openAddDialog(page);

    await dialog.getByLabel("Supplier name").fill("TechHub Distribution");
    await chooseCategory(page, "Electronics");
    await dialog.getByLabel("Contact person (optional)").fill("Maria Santos");
    await dialog.getByLabel("Phone (optional)").fill("+63 917 555 0101");
    await dialog.getByLabel("Email (optional)").fill("Orders@TechHub.example");
    await dialog.getByRole("button", { name: "Add supplier" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText('"TechHub Distribution" added')).toBeVisible();
    const row = rowFor(page, "TechHub Distribution");
    await expect(row).toBeVisible();
    // The contact shows in its own column (desktop) or under the name (phones); one copy is hidden.
    await expect(row.getByText("Maria Santos").filter({ visible: true })).toBeVisible();
    await expect(row.getByRole("link", { name: "0 products from TechHub Distribution" })).toBeVisible();

    if (test.info().project.name !== "mobile") {
      await expect(row.getByText("Electronics").filter({ visible: true })).toBeVisible();
      await expect(row.getByRole("link", { name: "+63 917 555 0101" })).toHaveAttribute("href", "tel:+63 917 555 0101");
      await expect(row.getByRole("link", { name: "orders@techhub.example" })).toHaveAttribute(
        "href",
        "mailto:orders@techhub.example",
      );
    }

    expect(await findSupplierByName(user.id, "TechHub Distribution")).toMatchObject({
      user_id: user.id,
      category: "Electronics",
      contact_person: "Maria Santos",
      phone: "+63 917 555 0101",
      email: "orders@techhub.example", // stored lowercase
    });
  });

  test("the form validates name, category, phone and email", async ({ page }) => {
    await page.goto("/dashboard/suppliers");
    const dialog = await openAddDialog(page);
    await dialog.getByRole("button", { name: "Add supplier" }).click();
    await expect(dialog.getByText("Enter the supplier name")).toBeVisible();
    await expect(dialog.getByText("Choose a category")).toBeVisible();

    await dialog.getByLabel("Supplier name").fill("Bad Contact Co");
    await chooseCategory(page, "Hardware");
    await dialog.getByLabel("Phone (optional)").fill("call me");
    await dialog.getByLabel("Email (optional)").fill("not-an-email");
    await dialog.getByRole("button", { name: "Add supplier" }).click();
    await expect(dialog.getByText("Enter a valid phone number")).toBeVisible();
    await expect(dialog.getByText("Enter a valid email address")).toBeVisible();
    expect(await findSupplierByName(user.id, "Bad Contact Co")).toBeNull();
  });

  test("supplier names are unique per user (ignoring case)", async ({ page }) => {
    await seedSuppliers(user.id, [{ name: "Acme Trading" }]);
    await page.goto("/dashboard/suppliers");
    const dialog = await openAddDialog(page);
    await dialog.getByLabel("Supplier name").fill("ACME trading");
    await chooseCategory(page, "Other");
    await dialog.getByRole("button", { name: "Add supplier" }).click();
    await expect(dialog.getByText("You already have a supplier with this name")).toBeVisible();
    await expect(dataRows(page)).toHaveCount(1);
  });

  test("edit a supplier", async ({ page }) => {
    const [s] = await seedSuppliers(user.id, [
      { name: "Old Name Inc.", category: "Hardware", contact_person: "Juan", phone: "+63 912 000 0000" },
    ]);
    await page.goto("/dashboard/suppliers");
    await page.getByRole("button", { name: "Edit Old Name Inc." }).click();
    const dialog = page.getByRole("dialog", { name: "Edit supplier" });
    await expect(dialog.getByLabel("Supplier name")).toHaveValue("Old Name Inc.");
    await expect(dialog.getByLabel("Contact person (optional)")).toHaveValue("Juan");

    await dialog.getByLabel("Supplier name").fill("New Name Corp.");
    await chooseCategory(page, "Cleaning Supplies");
    await dialog.getByLabel("Phone (optional)").fill("");
    await dialog.getByLabel("Email (optional)").fill("hello@newname.example");
    await dialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText('"New Name Corp." updated')).toBeVisible();
    await expect(rowFor(page, "New Name Corp.")).toBeVisible();
    await expect(rowFor(page, "Old Name Inc.")).toHaveCount(0);
    expect(await getSupplierRow(s.id)).toMatchObject({
      name: "New Name Corp.",
      category: "Cleaning Supplies",
      phone: null,
      email: "hello@newname.example",
    });
  });

  test("deleting a supplier keeps its products, without a supplier", async ({ page }) => {
    const [linkedA, linkedB] = await seedProducts(user.id, [
      { name: "Ink A", supplier: "Acme Trading" },
      { name: "Ink B", supplier: "Acme Trading" },
    ]);
    await page.goto("/dashboard/suppliers");
    await expect(rowFor(page, "Acme Trading").getByRole("link", { name: "2 products from Acme Trading" })).toBeVisible();

    await page.getByRole("button", { name: "Delete Acme Trading" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(confirm.getByText("2 products use this supplier. They'll be kept without a supplier.")).toBeVisible();
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(rowFor(page, "Acme Trading")).toBeVisible();

    await page.getByRole("button", { name: "Delete Acme Trading" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText('"Acme Trading" deleted')).toBeVisible();
    await expect(page.getByText("No suppliers yet").filter({ visible: true })).toBeVisible();

    for (const p of [linkedA, linkedB]) {
      expect(await getProductRow(p.id)).toMatchObject({ supplier_id: null });
    }
  });

  test("search by name, contact or email, and filter by category", async ({ page }) => {
    await seedSuppliers(user.id, [
      { name: "Northwind", category: "Food & Beverage", contact_person: "Ana Reyes", email: "ana@northwind.example" },
      { name: "Contoso", category: "Electronics", contact_person: "Ben Cruz", email: "sales@contoso.example" },
      { name: "Fabrikam", category: "Electronics", contact_person: "Cara Lim", phone: "+63 2 8123 4567" },
    ]);
    await page.goto("/dashboard/suppliers");
    await expect(dataRows(page)).toHaveCount(3);
    // Sorted by name.
    await expect(dataRows(page).first()).toContainText("Contoso");

    const search = page.getByRole("searchbox", { name: "Search suppliers" });
    await search.fill("north");
    await expect(page).toHaveURL(/q=north/);
    await expect(dataRows(page)).toHaveCount(1);
    await expect(rowFor(page, "Northwind")).toBeVisible();

    await search.fill("ben cruz");
    await expect(dataRows(page)).toHaveCount(1);
    await expect(rowFor(page, "Contoso")).toBeVisible();

    await search.fill("sales@contoso");
    await expect(dataRows(page)).toHaveCount(1);

    await search.fill("8123");
    await expect(rowFor(page, "Fabrikam")).toBeVisible();
    await expect(dataRows(page)).toHaveCount(1);

    await search.fill("");
    await expect(dataRows(page)).toHaveCount(3);
    await page.getByRole("combobox", { name: "Filter by category" }).click();
    await page.getByRole("option", { name: "Electronics", exact: true }).click();
    await expect(page).toHaveURL(/category=Electronics/);
    await expect(dataRows(page)).toHaveCount(2);

    await search.fill("zzz");
    await expect(page.getByText("No suppliers match “zzz”")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(dataRows(page)).toHaveCount(3);
    await expect(search).toHaveValue("");
  });

  test("pagination: 10 suppliers per page", async ({ page }) => {
    await seedSuppliers(
      user.id,
      Array.from({ length: 12 }, (_, i) => ({ name: `Supplier ${String(i + 1).padStart(2, "0")}` })),
    );
    await page.goto("/dashboard/suppliers");
    await expect(dataRows(page)).toHaveCount(10);
    await expect(page.getByText("Showing 1–10 of 12")).toBeVisible();
    await page.getByRole("link", { name: "Go to next page" }).click();
    await expect(page.getByText("Showing 11–12 of 12")).toBeVisible();
    await expect(dataRows(page)).toHaveCount(2);
    await expect(dataRows(page).first()).toContainText("Supplier 11");
  });

  test("product count links to that supplier's products", async ({ page }) => {
    await seedProducts(user.id, [
      { name: "Milk", supplier: "Dairy Farms" },
      { name: "Cheese", supplier: "Dairy Farms" },
      { name: "Paper", supplier: "Paper Co." },
    ]);
    await page.goto("/dashboard/suppliers");
    await page.getByRole("link", { name: "2 products from Dairy Farms" }).click();
    await expect(page).toHaveURL(/\/dashboard\/products\?supplier=/);
    await expect(page.getByText("Supplier:").filter({ visible: true })).toContainText("Dairy Farms");
    await expect(page.locator("tr[data-product-id]")).toHaveCount(2);

    await page.getByRole("button", { name: "Remove supplier filter" }).click();
    await expect(page.locator("tr[data-product-id]")).toHaveCount(3);
  });

  test("the product form lists saved suppliers and links the product", async ({ page }) => {
    const [dairy] = await seedSuppliers(user.id, [
      { name: "Dairy Farms", category: "Food & Beverage" },
      { name: "Paper Co.", category: "Office Supplies" },
    ]);
    await page.goto("/dashboard/products");
    await page.getByRole("button", { name: "Add product" }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add product" });
    await dialog.getByLabel("Product name").fill("Fresh Milk");
    await page.getByRole("combobox", { name: "Type of product" }).click();
    await page.getByRole("option", { name: "Food & Beverage", exact: true }).click();
    await dialog.getByLabel("Quantity").fill("30");

    const supplierSelect = dialog.getByRole("combobox", { name: "Supplier (optional)" });
    await expect(supplierSelect).toBeEnabled();
    await supplierSelect.click();
    await expect(page.getByRole("option")).toHaveCount(3); // "No supplier" + 2
    await page.getByRole("option", { name: /^Dairy Farms/ }).click();
    await dialog.getByRole("button", { name: "Add product" }).click();

    await expect(page.getByText('"Fresh Milk" added')).toBeVisible();
    const productRow = page.locator("tr[data-product-id]").filter({ hasText: "Fresh Milk" });
    await expect(productRow.getByText("Dairy Farms").first()).toBeAttached();
    const id = await productRow.getAttribute("data-product-id");
    expect(await getProductRow(id!)).toMatchObject({ supplier_id: dairy.id });

    // Searching products by the supplier's name finds it.
    await page.getByRole("searchbox", { name: "Search products" }).fill("dairy");
    await expect(page.locator("tr[data-product-id]")).toHaveCount(1);
  });

  test("users only see and change their own suppliers", async ({ page }) => {
    const other = await createConfirmedUser();
    try {
      const [theirs] = await seedSuppliers(other.id, [{ name: "Their Secret Supplier" }]);
      await seedSuppliers(user.id, [{ name: "My Supplier" }]);

      await page.goto("/dashboard/suppliers");
      await expect(rowFor(page, "My Supplier")).toBeVisible();
      await expect(page.getByText("Their Secret Supplier")).toHaveCount(0);

      const options = await (await page.request.get("/api/suppliers/options")).json();
      expect(options.options.map((o: { name: string }) => o.name)).toEqual(["My Supplier"]);

      const patch = await page.request.patch(`/api/suppliers/${theirs.id}`, {
        data: { name: "Hacked", category: "Other" },
      });
      expect(patch.status()).toBe(404);
      expect((await page.request.delete(`/api/suppliers/${theirs.id}`)).status()).toBe(404);
      expect(await getSupplierRow(theirs.id)).toMatchObject({ name: "Their Secret Supplier" });

      // A product can't be linked to someone else's supplier.
      const linked = await page.request.post("/api/products", {
        data: { name: "Sneaky", productType: "Other", quantity: 1, reorderLevel: 1, supplierId: theirs.id },
      });
      expect(linked.status()).toBe(400);
      expect((await linked.json()).fieldErrors.supplierId).toBe("Choose a supplier from your list");
    } finally {
      await deleteUser(other.id);
    }
  });

  test("@mobile supplier table fits the screen and actions are reachable", async ({ page }) => {
    await seedSuppliers(user.id, [
      {
        name: "A Supplier With A Rather Long Business Name",
        category: "Medicine",
        contact_person: "Dr. Isabel Fernandez",
        phone: "+63 917 555 0199",
        email: "very.long.email.address@pharma-distributors.example",
      },
    ]);
    await page.goto("/dashboard/suppliers");
    await expect(dataRows(page)).toHaveCount(1);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const name = "A Supplier With A Rather Long Business Name";
    if (page.viewportSize()!.width < 640) {
      const trigger = page.getByRole("button", { name: `Actions for ${name}` });
      await expect(trigger).toBeInViewport({ ratio: 1 });
      await trigger.click();
      await page.getByRole("menuitem", { name: "Edit" }).click();
      await expect(page.getByRole("dialog", { name: "Edit supplier" })).toBeVisible();
    } else {
      await expect(page.getByRole("button", { name: `Edit ${name}` })).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole("button", { name: `Delete ${name}` })).toBeInViewport({ ratio: 1 });
    }
  });
});
