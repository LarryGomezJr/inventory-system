import { expect, test } from "@playwright/test";

const json = (data: unknown) => ({ data, headers: { "Content-Type": "application/json" } });

test.describe("auth API input handling", () => {
  test("malformed JSON is rejected with 400", async ({ request }) => {
    for (const route of ["signup", "login", "signup/verify", "login/verify", "forgot-password", "reset-password"]) {
      const res = await request.post(`/api/auth/${route}`, {
        data: "not json",
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status(), route).toBe(400);
      expect((await res.json()).ok).toBe(false);
    }
  });

  test("signup returns per-field errors", async ({ request }) => {
    const res = await request.post("/api/auth/signup", json({ email: "x" }));
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(Object.keys(body.fieldErrors)).toEqual(
      expect.arrayContaining(["fullName", "username", "phone", "email", "password"]),
    );
  });

  test("codes must be exactly 6 digits", async ({ request }) => {
    for (const token of ["12345", "1234567", "abcdef"]) {
      const res = await request.post("/api/auth/signup/verify", json({ email: "a@b.co", token }));
      expect(res.status()).toBe(400);
      expect((await res.json()).fieldErrors.token).toBe("Enter the 6-digit code");
    }
  });

  test("session endpoints refuse requests without a session", async ({ request }) => {
    const heartbeat = await request.post("/api/auth/heartbeat");
    expect(heartbeat.status()).toBe(401);
    expect((await heartbeat.json()).code).toBe("SESSION_EXPIRED");

    const resend = await request.post("/api/auth/login/resend");
    expect(resend.status()).toBe(401);

    const verify = await request.post("/api/auth/login/verify", json({ token: "123456" }));
    expect(verify.status()).toBe(401);
    expect((await verify.json()).code).toBe("CHALLENGE_EXPIRED");
  });

  test("logout is safe to call when already signed out", async ({ request }) => {
    const res = await request.post("/api/auth/logout");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true, redirectTo: "/login" });
  });

  test("forged login_challenge cookie is ignored", async ({ request }) => {
    const res = await request.post("/api/auth/login/verify", {
      ...json({ token: "123456" }),
      headers: { "Content-Type": "application/json", cookie: "login_challenge=00000000-0000-0000-0000-000000000000" },
    });
    expect(res.status()).toBe(401);
  });
});
