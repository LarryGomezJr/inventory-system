import { fail, ok, parseBody } from "@/lib/api";
import { clearChallengeCookie, getActiveChallenge } from "@/lib/login-challenge";
import { OTP_MAX_ATTEMPTS, verifyOtpHash } from "@/lib/otp";
import { touchActivity } from "@/lib/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { loginVerifySchema } from "@/lib/validations/auth";

/** Step 2 of sign-in: check the emailed code, then create the real session. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, loginVerifySchema);
  if ("response" in parsed) return parsed.response;
  const { token } = parsed.data;

  const challenge = await getActiveChallenge();
  if (!challenge) {
    return fail("Your sign-in session expired. Please sign in again.", 401, {
      code: "CHALLENGE_EXPIRED",
    });
  }

  if (new Date(challenge.expires_at).getTime() < Date.now()) {
    return fail("This code has expired. Request a new one.", 400, {
      code: "CODE_EXPIRED",
    });
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return fail("Too many wrong attempts. Request a new code.", 429, {
      code: "TOO_MANY_ATTEMPTS",
    });
  }

  const admin = createAdminClient();

  if (!verifyOtpHash(token, challenge.id, challenge.code_hash)) {
    // Optimistic lock so parallel guesses can't share one attempt.
    await admin
      .from("login_challenges")
      .update({ attempts: challenge.attempts + 1 })
      .eq("id", challenge.id)
      .eq("attempts", challenge.attempts);

    const left = OTP_MAX_ATTEMPTS - challenge.attempts - 1;
    return fail(
      left > 0
        ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many wrong attempts. Request a new code.",
      400,
      { fieldErrors: { token: "Incorrect code" } },
    );
  }

  // Mark consumed first so the same code can't be replayed.
  const { data: consumed } = await admin
    .from("login_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challenge.id)
    .is("consumed_at", null)
    .select("id");
  if (!consumed?.length) {
    return fail("This code was already used. Please sign in again.", 409, {
      code: "CHALLENGE_EXPIRED",
    });
  }

  // Mint a session for the user without sending another email.
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: challenge.email,
  });
  if (linkError || !link.properties?.hashed_token) {
    console.error("generateLink failed", linkError);
    return fail("Could not sign you in. Please try again.", 500);
  }

  const supabase = await createClient();
  const { error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (sessionError) {
    console.error("verifyOtp(magiclink) failed", sessionError);
    return fail("Could not sign you in. Please try again.", 500);
  }

  await clearChallengeCookie();
  await touchActivity(challenge.user_id);
  return ok({ redirectTo: "/dashboard" });
}
