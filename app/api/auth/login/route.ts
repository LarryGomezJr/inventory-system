import { fail, ok, parseBody } from "@/lib/api";
import { maskEmail, startLoginChallenge } from "@/lib/login-challenge";
import { createStatelessClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validations/auth";

/**
 * Step 1 of sign-in: check the password, then email a one-time code.
 * No session cookie is set here — that only happens in /api/auth/login/verify.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, loginSchema);
  if ("response" in parsed) return parsed.response;
  const { email, password } = parsed.data;

  const temp = createStatelessClient();
  const { data, error } = await temp.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      await temp.auth.resend({ type: "signup", email });
      return fail("Please verify your email first. We sent you a new code.", 403, {
        code: "EMAIL_NOT_CONFIRMED",
      });
    }
    return fail("Incorrect email or password.", 401);
  }

  // The password was right — throw this session away immediately.
  await temp.auth.signOut({ scope: "local" });

  try {
    await startLoginChallenge(data.user.id, email);
  } catch (err) {
    console.error("startLoginChallenge failed", err);
    return fail("Could not send your sign-in code. Please try again.", 500);
  }

  return ok({ maskedEmail: maskEmail(email) });
}
