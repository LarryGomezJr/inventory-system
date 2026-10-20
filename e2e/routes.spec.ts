import { expect, test } from "@playwright/test";
import { signInDirect } from "./helpers/auth";
import { createConfirmedUser, deleteUser, type TestUser } from "./helpers/supabase";

test.describe("route protection", () => {
  test("signed-out visitors are sent to /login", async ({ page }) => {
    for (const path of ["/", "/dashboard"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });

  test.describe("signed in", () => {
    let user: TestUser;
    test.beforeAll(async () => {
      user = await createConfirmedUser();
    });
    test.afterAll(async () => {
      await deleteUser(user?.id);
    });

    test("auth pages and / redirect to the dashboard", async ({ page, context }) => {
      await signInDirect(context, user);
      for (const path of ["/", "/login", "/signup", "/forgot-password"]) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/dashboard$/);
      }
    });
  });
});
