import { fail, ok } from "@/lib/api";
import { getActiveChallenge, refreshLoginChallenge } from "@/lib/login-challenge";
import { OTP_RESEND_COOLDOWN_SECONDS } from "@/lib/otp";

export async function POST() {
  const challenge = await getActiveChallenge();
  if (!challenge) {
    return fail("Your sign-in session expired. Please sign in again.", 401, {
      code: "CHALLENGE_EXPIRED",
    });
  }

  const elapsed = (Date.now() - new Date(challenge.last_sent_at).getTime()) / 1000;
  if (elapsed < OTP_RESEND_COOLDOWN_SECONDS) {
    const wait = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed);
    return fail(`Please wait ${wait}s before requesting another code.`, 429, {
      code: "COOLDOWN",
    });
  }

  try {
    await refreshLoginChallenge(challenge);
  } catch (err) {
    console.error("refreshLoginChallenge failed", err);
    return fail("Could not send a new code. Please try again.", 500);
  }

  return ok();
}
