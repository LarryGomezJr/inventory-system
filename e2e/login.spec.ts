import { expect, test } from "@playwright/test";
import { enterOtp, signInViaUi, submitPassword } from "./helpers/auth";
import {
  BASE_URL,
  createConfirmedUser,
  createUnconfirmedUser,
  deleteUser,
  getOpenChallenge,
  setLoginCode,
  type TestUser,
} from "./helpers/supabase";

test.describe("2-step sign in", () => {
  let user: TestUser;
  test.beforeAll(async () => {
    user = await createConfirmedUser();
  });
  test.afterAll(async () => {
    await deleteUser(user?.id);
  });

  test("validates the form", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Enter your password")).toBeVisible();
  });

  test("wrong password is rejected and no code is issued", async ({ page }) => {
    await submitPassword(page, user.email, "Wrong#Password1");
    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password." })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect(await getOpenChallenge(user.id)).toBeNull();
  });

  test("unknown email gets the same generic error", async ({ page }) => {
    await submitPassword(page, "nobody-e2e@example.com", "Whatever#123");
    await expect(page.getByRole("alert").filter({ hasText: "Incorrect email or password." })).toBeVisible();
  });

  test("password → code → dashboard, wrong code shows attempts left", async ({ page }) => {
    await submitPassword(page, user.email, user.password);
    await expect(page).toHaveURL(/\/login\/verify$/);
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    // Masked email, e.g. l***@gmail.com
    await expect(page.getByText(/\*\*\*/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Resend in \d+s/ })).toBeDisabled();

    const code = await setLoginCode(user.id, "246810");
    await enterOtp(page, "111111");
    await expect(page.getByText("Incorrect code. 4 attempts left.")).toBeVisible();

    await enterOtp(page, code);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Welcome back, Test" })).toBeVisible();
  });

  test("5 wrong codes lock the challenge, even the right code then fails", async ({ page }) => {
    await submitPassword(page, user.email, user.password);
    await expect(page).toHaveURL(/\/login\/verify$/);
    const code = await setLoginCode(user.id, "135790");

    for (const left of [4, 3, 2, 1]) {
      await enterOtp(page, "000000");
      await expect(page.getByText(`Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`)).toBeVisible();
    }
    await enterOtp(page, "000000");
    await expect(page.getByText("Too many wrong attempts. Request a new code.")).toBeVisible();

    await enterOtp(page, code);
    await expect(page.getByText("Too many wrong attempts. Request a new code.")).toBeVisible();
    await expect(page).toHaveURL(/\/login\/verify$/);
  });

  test("a used code cannot be replayed", async ({ page, request }) => {
    await submitPassword(page, user.email, user.password);
    await expect(page).toHaveURL(/\/login\/verify$/);
    const challengeCookie = (await page.context().cookies()).find((c) => c.name === "login_challenge");
    expect(challengeCookie?.httpOnly).toBe(true);

    const code = await setLoginCode(user.id);
    await enterOtp(page, code);
    await expect(page).toHaveURL(/\/dashboard$/);

    const replay = await request.post(`${BASE_URL}/api/auth/login/verify`, {
      headers: { cookie: `login_challenge=${challengeCookie!.value}` },
      data: { token: code },
    });
    expect(replay.status()).toBe(401);
    expect((await replay.json()).code).toBe("CHALLENGE_EXPIRED");
  });

  test("code page without a pending sign-in sends you back to /login", async ({ page }) => {
    await page.goto("/login/verify");
    await enterOtp(page, "123456");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText("Your sign-in session expired. Please sign in again.")).toBeVisible();
  });

  test("full helper flow works (used by other suites)", async ({ page }) => {
    await signInViaUi(page, user);
  });
});

test.describe("unverified account", () => {
  let pending: TestUser;
  test.beforeAll(async () => {
    pending = await createUnconfirmedUser();
  });
  test.afterAll(async () => {
    await deleteUser(pending?.id);
  });

  test("is sent to verify their email instead of signing in", async ({ page }) => {
    await submitPassword(page, pending.email, pending.password);
    await expect(page).toHaveURL(/\/verify-email\?email=/);
    await expect(page.getByRole("heading", { name: "Verify your email" })).toBeVisible();
    expect(await getOpenChallenge(pending.id)).toBeNull();
  });
});
