import { expect, test, type Page } from "@playwright/test";
import { signInDirect, signInViaUi } from "./helpers/auth";
import {
  activityCookie,
  activityCookieValue,
  createConfirmedUser,
  deleteUser,
  type TestUser,
} from "./helpers/supabase";

/** The idle timer has mounted once it records its first touch in localStorage. */
async function idleTimerStarted(page: Page) {
  await page.waitForFunction(() => localStorage.getItem("inv_session_touch"));
}

test.describe("session security & 30-minute idle timeout", () => {
  let user: TestUser;
  test.beforeAll(async () => {
    user = await createConfirmedUser();
  });
  test.afterAll(async () => {
    await deleteUser(user?.id);
  });

  test("session tokens are httpOnly and invisible to page JavaScript", async ({ page, context }) => {
    await signInViaUi(page, user);

    const cookies = await context.cookies();
    const authCookies = cookies.filter((c) => /^sb-.*-auth-token/.test(c.name));
    const activity = cookies.find((c) => c.name === "session_activity");

    expect(authCookies.length).toBeGreaterThan(0);
    for (const c of authCookies) expect(c.httpOnly, `${c.name} should be httpOnly`).toBe(true);
    expect(activity?.httpOnly).toBe(true);
    // Expires within the 30-minute idle window.
    expect(activity!.expires * 1000 - Date.now()).toBeLessThanOrEqual(30 * 60 * 1000 + 5000);

    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toMatch(/sb-.*-auth-token/);
    expect(visible).not.toContain("session_activity");
    expect(visible).not.toContain("login_challenge");
  });

  test("activity cookie is renewed on every page request", async ({ page, context }) => {
    await signInDirect(context, user);
    // Start from a window that is 10 minutes old.
    await context.addCookies([activityCookie(user.id, Date.now() - 10 * 60 * 1000)]);
    const before = (await context.cookies()).find((c) => c.name === "session_activity")!.value;

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    const after = (await context.cookies()).find((c) => c.name === "session_activity")!.value;

    expect(after).not.toBe(before);
    const ts = (v: string) => Number(v.split(".")[1]);
    expect(ts(after) - ts(before)).toBeGreaterThan(9 * 60 * 1000);
  });

  test("warning at 28 min idle; 'Stay signed in' keeps the session", async ({ page, context }) => {
    await page.clock.install();
    await signInDirect(context, user);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await idleTimerStarted(page);

    await page.clock.fastForward("28:00");
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Are you still there?")).toBeVisible();
    await expect(dialog.getByText(/[12]:\d{2}/)).toBeVisible();

    await dialog.getByRole("button", { name: "Stay signed in" }).click();
    await expect(dialog).toBeHidden();
    await page.clock.fastForward("05:00");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("signed out automatically after 30 min idle", async ({ page, context }) => {
    await page.clock.install();
    await signInDirect(context, user);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await idleTimerStarted(page);

    await page.clock.fastForward("30:05");
    await expect(page).toHaveURL(/\/login\?expired=1$/);
    await expect(page.getByText("You were signed out due to inactivity.")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("'Sign out' in the idle warning signs out immediately", async ({ page, context }) => {
    await page.clock.install();
    await signInDirect(context, user);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await idleTimerStarted(page);

    await page.clock.fastForward("28:30");
    await page.getByRole("alertdialog").getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  const serverCases: { name: string; cookie: (u: TestUser) => string | null }[] = [
    { name: "idle for 31 minutes", cookie: (u) => activityCookieValue(u.id, Date.now() - 31 * 60 * 1000) },
    {
      name: "tampered timestamp",
      cookie: (u) => {
        const [id, ts, sig] = activityCookieValue(u.id, Date.now() - 31 * 60 * 1000).split(".");
        return [id, String(Number(ts) + 30 * 60 * 1000), sig].join(".");
      },
    },
    { name: "signed for a different user", cookie: () => activityCookieValue("00000000-0000-0000-0000-000000000000") },
    { name: "missing", cookie: () => null },
  ];

  for (const c of serverCases) {
    test(`server signs out when the activity cookie is ${c.name}`, async ({ page, context }) => {
      await signInDirect(context, user);
      const value = c.cookie(user);
      if (value === null) {
        await context.clearCookies({ name: "session_activity" });
      } else {
        await context.addCookies([activityCookie(user.id, Date.now(), value)]);
      }

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?expired=1$/);

      // Auth cookies were cleared and the session no longer works.
      const left = (await context.cookies()).filter((ck) => /^sb-.*-auth-token/.test(ck.name) && ck.value);
      expect(left).toHaveLength(0);
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("heartbeat renews the window and rejects expired sessions", async ({ page, context }) => {
    await signInDirect(context, user);
    await page.goto("/dashboard");

    const ok = await page.request.post("/api/auth/heartbeat");
    expect(ok.status()).toBe(200);
    expect((await ok.json()).idleTimeoutSeconds).toBe(1800);

    await context.addCookies([activityCookie(user.id, Date.now() - 31 * 60 * 1000)]);
    const expired = await page.request.post("/api/auth/heartbeat");
    expect(expired.status()).toBe(401);
    expect((await expired.json()).code).toBe("SESSION_EXPIRED");
  });
});
