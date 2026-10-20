import { expect, type BrowserContext, type Page } from "@playwright/test";
import { sessionCookiesFor, setLoginCode, type TestUser } from "./supabase";

export function otpInput(page: Page) {
  return page.locator('input[autocomplete="one-time-code"]');
}

/** Types a 6-digit code into the OTP field (auto-submits on the 6th digit). */
export async function enterOtp(page: Page, code: string) {
  const input = otpInput(page);
  await expect(input).toBeEnabled();
  await input.fill("");
  await input.fill(code);
}

export async function submitPassword(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Full 2-step UI sign-in: password → (known) emailed code → dashboard. */
export async function signInViaUi(page: Page, user: TestUser) {
  await submitPassword(page, user.email, user.password);
  await expect(page).toHaveURL(/\/login\/verify$/);
  const code = await setLoginCode(user.id);
  await enterOtp(page, code);
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Signed-in browser context without the email round-trip. */
export async function signInDirect(context: BrowserContext, user: TestUser) {
  await context.addCookies(await sessionCookiesFor(user));
}
