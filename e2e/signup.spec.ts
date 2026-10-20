import { expect, test, type Page } from "@playwright/test";
import { enterOtp } from "./helpers/auth";
import {
  createConfirmedUser,
  createUnconfirmedUser,
  deleteUser,
  findUserIdByEmail,
  getSignupOtp,
  getTblUser,
  newTestIdentity,
  type TestUser,
} from "./helpers/supabase";

async function fillSignup(
  page: Page,
  v: { fullName: string; username: string; phone: string; email: string; password: string; confirm?: string },
) {
  await page.goto("/signup");
  await page.getByLabel("Full name").fill(v.fullName);
  await page.getByLabel("Username").fill(v.username);
  await page.getByLabel("Phone number").fill(v.phone);
  await page.getByLabel("Email").fill(v.email);
  await page.getByLabel("Password", { exact: true }).fill(v.password);
  await page.getByLabel("Confirm password").fill(v.confirm ?? v.password);
  await page.getByRole("button", { name: "Create account" }).click();
}

test.describe("sign up", () => {
  const cleanup: (string | undefined)[] = [];
  test.afterAll(async () => {
    for (const idOrEmail of cleanup) await deleteUser(idOrEmail);
  });

  test("shows validation errors for invalid input", async ({ page }) => {
    await fillSignup(page, {
      fullName: "A",
      username: "bad name!",
      phone: "abc",
      email: "not-an-email",
      password: "short",
      confirm: "different",
    });
    await expect(page.getByText("Enter your full name")).toBeVisible();
    await expect(page.getByText("Letters, numbers, dots and underscores only")).toBeVisible();
    await expect(page.getByText("Enter a valid phone number")).toBeVisible();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("At least 8 characters")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("weak password and mismatched confirmation are rejected", async ({ page }) => {
    const id = newTestIdentity();
    await fillSignup(page, { ...id, password: "alllowercase1" });
    await expect(page.getByText("Include an uppercase letter")).toBeVisible();

    await fillSignup(page, { ...id, confirm: "Something#Else1" });
    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });

  test("full signup: email code → dashboard, and tbl_user row is stored without a password", async ({ page }) => {
    const id = newTestIdentity();
    cleanup.push(id.email);

    await fillSignup(page, id);
    await expect(page).toHaveURL(/\/verify-email\?email=/);
    await expect(page.getByText(id.email)).toBeVisible();

    // Wrong code first.
    await enterOtp(page, "000000");
    await expect(page.getByText("That code is invalid or has expired.")).toBeVisible();

    // A valid code (fresh one from the admin API, same as the emailed code).
    const code = await getSignupOtp(id.email, id.password);
    await enterOtp(page, code);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Welcome back, Test" })).toBeVisible();

    const userId = await findUserIdByEmail(id.email);
    expect(userId).toBeTruthy();
    const row = await getTblUser(userId!);
    expect(row).toMatchObject({
      full_name: id.fullName,
      username: id.username,
      phone_number: id.phone,
      email: id.email,
    });
    const columns = Object.keys(row!);
    expect(columns.sort()).toEqual(
      ["created_at", "email", "full_name", "id", "phone_number", "updated_at", "username"].sort(),
    );
    expect(columns.some((c) => /pass|hash|token|secret/i.test(c))).toBe(false);
  });

  test.describe("duplicates", () => {
    let existing: TestUser;
    test.beforeAll(async () => {
      existing = await createConfirmedUser();
      cleanup.push(existing.id);
    });

    test("an email that is already registered is rejected", async ({ page }) => {
      const id = newTestIdentity();
      await fillSignup(page, { ...id, email: existing.email });
      await expect(page.getByText("This email is already registered")).toBeVisible();
      await expect(page).toHaveURL(/\/signup$/);
    });

    test("a username that is taken is rejected (case-insensitive)", async ({ page }) => {
      const id = newTestIdentity();
      await fillSignup(page, { ...id, username: existing.username.toUpperCase() });
      await expect(page.getByText("This username is already taken")).toBeVisible();
      await expect(page).toHaveURL(/\/signup$/);
    });
  });

  test("signing up again with an unverified email resends the code", async ({ page }) => {
    const pending = await createUnconfirmedUser();
    cleanup.push(pending.id);

    await fillSignup(page, { ...pending });
    await expect(page.getByText("This email is waiting for verification")).toBeVisible();
    await expect(page).toHaveURL(/\/verify-email\?email=/);
  });

  test("verify page without an email explains what to do", async ({ page }) => {
    await page.goto("/verify-email");
    await expect(page.getByText("We couldn't tell which email to verify.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to sign up" })).toBeVisible();
  });
});
