import { expect, test, type Page } from "@playwright/test";
import { enterOtp, signInViaUi, submitPassword } from "./helpers/auth";
import { createConfirmedUser, deleteUser, getRecoveryOtp, type TestUser } from "./helpers/supabase";

async function requestReset(page: Page, email: string) {
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset code" }).click();
}

async function submitReset(page: Page, code: string, password: string, confirm = password) {
  await enterOtp(page, code);
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password").fill(confirm);
  await page.getByRole("button", { name: "Update password" }).click();
}

test.describe("forgot / reset password", () => {
  let user: TestUser;
  test.beforeAll(async () => {
    user = await createConfirmedUser();
  });
  test.afterAll(async () => {
    await deleteUser(user?.id);
  });

  test("validates the email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nope");
    await page.getByRole("button", { name: "Send reset code" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });

  test("unknown emails get the same response (no account enumeration)", async ({ page }) => {
    await requestReset(page, "nobody-e2e-reset@example.com");
    await expect(page.getByText("If that email has an account, a reset code is on its way.")).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password\?email=/);
  });

  test("reset page without an email links back to the request form", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page.getByRole("link", { name: "Request a reset code" })).toBeVisible();
  });

  test("wrong code and mismatched passwords are rejected; correct code changes the password", async ({ page }) => {
    await requestReset(page, user.email);
    await expect(page).toHaveURL(/\/reset-password\?email=/);
    const newPassword = "Reset#Pass2026b";

    await submitReset(page, "000000", newPassword, "Different#Pass1");
    await expect(page.getByText("Passwords do not match")).toBeVisible();

    await submitReset(page, "000000", newPassword);
    await expect(page.getByRole("alert").filter({ hasText: "That code is invalid or has expired." })).toBeVisible();

    const code = await getRecoveryOtp(user.email);
    await submitReset(page, code, newPassword);
    await expect(page).toHaveURL(/\/login\?reset=1$/);
    await expect(page.getByText("Password updated. Sign in with your new password.")).toBeVisible();

    // Old password no longer works…
    await submitPassword(page, user.email, user.password);
    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password." })).toBeVisible();

    // …the new one does (with the login code).
    user = { ...user, password: newPassword };
    await signInViaUi(page, user);
  });
});
