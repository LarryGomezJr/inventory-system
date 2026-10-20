import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLoginCodeEmail } from "@/lib/mailer";
import {
  LOGIN_CHALLENGE_COOKIE,
  OTP_TTL_SECONDS,
  generateOtp,
  hashOtp,
} from "@/lib/otp";

export type LoginChallenge = {
  id: string;
  user_id: string;
  email: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
  last_sent_at: string;
  consumed_at: string | null;
};

async function getDisplayName(userId: string) {
  const { data } = await createAdminClient()
    .from("tbl_user")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name || undefined;
}

/** Creates a new challenge (invalidating older ones), emails the code, sets the cookie. */
export async function startLoginChallenge(userId: string, email: string) {
  const admin = createAdminClient();
  const id = randomUUID();
  const code = generateOtp();
  const now = new Date();

  await admin
    .from("login_challenges")
    .delete()
    .eq("user_id", userId)
    .is("consumed_at", null);

  const { error } = await admin.from("login_challenges").insert({
    id,
    user_id: userId,
    email,
    code_hash: hashOtp(code, id),
    expires_at: new Date(now.getTime() + OTP_TTL_SECONDS * 1000).toISOString(),
    last_sent_at: now.toISOString(),
  });
  if (error) throw error;

  await sendLoginCodeEmail(email, code, await getDisplayName(userId));
  await setChallengeCookie(id);
  return id;
}

/** Issues a fresh code for an existing challenge (resend). */
export async function refreshLoginChallenge(challenge: LoginChallenge) {
  const code = generateOtp();
  const now = new Date();

  const { error } = await createAdminClient()
    .from("login_challenges")
    .update({
      code_hash: hashOtp(code, challenge.id),
      attempts: 0,
      last_sent_at: now.toISOString(),
      expires_at: new Date(now.getTime() + OTP_TTL_SECONDS * 1000).toISOString(),
    })
    .eq("id", challenge.id);
  if (error) throw error;

  await sendLoginCodeEmail(challenge.email, code, await getDisplayName(challenge.user_id));
  await setChallengeCookie(challenge.id);
}

/** Reads the active (unconsumed) challenge referenced by the cookie. */
export async function getActiveChallenge(): Promise<LoginChallenge | null> {
  const id = (await cookies()).get(LOGIN_CHALLENGE_COOKIE)?.value;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;

  const { data } = await createAdminClient()
    .from("login_challenges")
    .select("*")
    .eq("id", id)
    .is("consumed_at", null)
    .maybeSingle<LoginChallenge>();
  return data ?? null;
}

async function setChallengeCookie(id: string) {
  (await cookies()).set(LOGIN_CHALLENGE_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OTP_TTL_SECONDS,
  });
}

export async function clearChallengeCookie() {
  (await cookies()).delete(LOGIN_CHALLENGE_COOKIE);
}

/** Masks an email for display, e.g. j***@gmail.com */
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}
