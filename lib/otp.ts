import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
export const LOGIN_CHALLENGE_COOKIE = "login_challenge";

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** Hash bound to the challenge id so a leaked hash can't be reused elsewhere. */
export function hashOtp(code: string, challengeId: string): string {
  const pepper = process.env.OTP_PEPPER ?? "";
  return createHash("sha256")
    .update(`${challengeId}:${code}:${pepper}`)
    .digest("hex");
}

export function verifyOtpHash(
  code: string,
  challengeId: string,
  expectedHash: string,
): boolean {
  const actual = Buffer.from(hashOtp(code, challengeId), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
