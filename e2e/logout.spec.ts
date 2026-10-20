import { expect, test } from "@playwright/test";
import { signInDirect } from "./helpers/auth";
import { createConfirmedUser, deleteUser, type TestUser } from "./helpers/supabase";

test.describe("sign out", () => {
  let user: TestUser;
  test.beforeAll(async () => {
    user = await createConfirmedUser();
  });
  test.afterAll(async () => {
    await deleteUser(user?.id);
  });

  test("user menu shows the account and signs out", async ({ page, context }) => {
    await signInDirect(context, user);
    await page.goto("/dashboard");

    await page.getByRole("button", { name: new RegExp(user.fullName) }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByText(user.email)).toBeVisible();

    await menu.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    const activity = (await context.cookies()).find((c) => c.name === "session_activity");
    expect(activity?.value ?? "").toBe("");

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await page.goBack();
    await expect(page).toHaveURL(/\/login/);
  });

  test("copied session cookies stop working after sign out", async ({ page, context, browser }) => {
    await signInDirect(context, user);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    const stolen = await context.cookies();

    const res = await page.request.post("/api/auth/logout");
    expect(res.ok()).toBe(true);

    // Replay the pre-logout cookies in a fresh browser.
    const other = await browser.newContext();
    await other.addCookies(stolen);
    const otherPage = await other.newPage();
    await otherPage.goto("/dashboard");
    await expect(otherPage).toHaveURL(/\/login/);
    await other.close();
  });
});
