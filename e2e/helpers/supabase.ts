import { createHash, createHmac, randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing — tests read it from .env.local`);
  return value;
}

export const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const TEST_PASSWORD = "E2eTest#2026a";

export type TestUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
  username: string;
  phone: string;
};

/** Plus-address of the SMTP inbox so test emails never bounce. */
export function newTestIdentity(): Omit<TestUser, "id"> {
  const tag = `${Date.now().toString(36)}${randomBytes(2).toString("hex")}`;
  const [local, domain] = (process.env.E2E_EMAIL ?? env("SMTP_USER")).split("@");
  return {
    email: `${local}+e2e-${tag}@${domain}`.toLowerCase(),
    password: TEST_PASSWORD,
    fullName: `Test User ${tag}`,
    username: `e2e_${tag}`,
    phone: "+63 912 345 6789",
  };
}

async function createUser(confirmed: boolean): Promise<TestUser> {
  const identity = newTestIdentity();
  const { data, error } = await admin.auth.admin.createUser({
    email: identity.email,
    password: identity.password,
    email_confirm: confirmed,
    user_metadata: {
      full_name: identity.fullName,
      username: identity.username,
      phone: identity.phone,
    },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, ...identity };
}

export const createConfirmedUser = () => createUser(true);
export const createUnconfirmedUser = () => createUser(false);

export async function findUserIdByEmail(email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (data.users.length < 200) break;
  }
  return null;
}

export async function deleteUser(idOrEmail: string | undefined | null) {
  if (!idOrEmail) return;
  const id = idOrEmail.includes("@") ? await findUserIdByEmail(idOrEmail) : idOrEmail;
  if (id) await admin.auth.admin.deleteUser(id);
}

function assertSixDigits(otp: string) {
  if (!/^\d{6}$/.test(otp)) {
    throw new Error(
      `Supabase issued a ${otp.length}-digit code but the app expects 6. Set Authentication → ` +
        "Sign In / Providers → Email → Email OTP Length to 6.",
    );
  }
  return otp;
}

/** A fresh, valid signup code (replaces the one Supabase emailed). */
export async function getSignupOtp(email: string, password: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "signup", email, password });
  if (error) throw error;
  return assertSixDigits(data.properties.email_otp);
}

/** A fresh, valid password-reset code (replaces the one Supabase emailed). */
export async function getRecoveryOtp(email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) throw error;
  return assertSixDigits(data.properties.email_otp);
}

export async function getOpenChallenge(userId: string) {
  const { data } = await admin
    .from("login_challenges")
    .select("*")
    .eq("user_id", userId)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; attempts: number } | null;
}

/** Points the user's open login challenge at a known code (same hash as lib/otp.ts). */
export async function setLoginCode(userId: string, code = "123456") {
  let challenge = null;
  for (let i = 0; i < 20 && !challenge; i++) {
    challenge = await getOpenChallenge(userId);
    if (!challenge) await new Promise((r) => setTimeout(r, 250));
  }
  if (!challenge) throw new Error("No open login challenge for user");
  const pepper = process.env.OTP_PEPPER ?? "";
  const code_hash = createHash("sha256").update(`${challenge.id}:${code}:${pepper}`).digest("hex");
  const { error } = await admin.from("login_challenges").update({ code_hash }).eq("id", challenge.id);
  if (error) throw error;
  return code;
}

export async function getTblUser(userId: string) {
  const { data, error } = await admin.from("tbl_user").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

/** Same format and HMAC as lib/session-activity.ts. */
export function activityCookieValue(userId: string, lastActiveMs = Date.now()) {
  const payload = `${userId}.${lastActiveMs}`;
  const sig = createHmac("sha256", env("SESSION_SECRET")).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function activityCookie(userId: string, lastActiveMs = Date.now(), value?: string) {
  return {
    name: "session_activity",
    value: value ?? activityCookieValue(userId, lastActiveMs),
    url: BASE_URL,
    httpOnly: true,
    sameSite: "Lax" as const,
  };
}

/**
 * Builds real Supabase session cookies for a user the same way the app's
 * login/verify route does (admin magic-link hash → verifyOtp), so tests that
 * aren't about the login flow don't need an email round-trip.
 */
export async function sessionCookiesFor(user: TestUser) {
  const jar = new Map<string, string>();
  const client = createServerClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });

  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
  if (error) throw error;
  const { error: verifyError } = await client.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError?.status === 429) {
    throw new Error(
      "Supabase token-verification rate limit reached. Wait 5 minutes, or raise " +
        "Authentication → Rate Limits → 'Rate limit for token verifications'.",
    );
  }
  if (verifyError) throw verifyError;

  return [
    ...[...jar].map(([name, value]) => ({
      name,
      value,
      url: BASE_URL,
      httpOnly: true,
      sameSite: "Lax" as const,
    })),
    activityCookie(user.id),
  ];
}
