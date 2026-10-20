import { fail, ok, parseBody } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStatelessClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const parsed = await parseBody(request, signupSchema);
  if ("response" in parsed) return parsed.response;
  const { fullName, username, phone, email, password } = parsed.data;

  const admin = createAdminClient();
  const { data: availability, error: availabilityError } = await admin
    .rpc("check_signup_availability", { p_email: email, p_username: username })
    .single<{ email_status: "none" | "unconfirmed" | "confirmed"; username_taken: boolean }>();

  if (availabilityError) {
    console.error("check_signup_availability failed", availabilityError);
    return fail("Could not create your account. Please try again.", 500);
  }

  if (availability.email_status === "confirmed") {
    return fail("An account with this email already exists.", 409, {
      fieldErrors: { email: "This email is already registered" },
    });
  }

  if (availability.email_status === "unconfirmed") {
    // Account exists but was never verified: send a fresh code and continue.
    await createStatelessClient().auth.resend({ type: "signup", email });
    return ok({ email, resent: true });
  }

  if (availability.username_taken) {
    return fail("That username is taken.", 409, {
      fieldErrors: { username: "This username is already taken" },
    });
  }

  const { error } = await createStatelessClient().auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, username, phone },
    },
  });

  if (error) {
    console.error("signUp failed", error);
    if (error.code === "over_email_send_rate_limit") {
      return fail("Too many emails sent. Please wait a minute and try again.", 429);
    }
    if (error.code === "weak_password") {
      return fail(error.message, 400, { fieldErrors: { password: error.message } });
    }
    return fail("Could not create your account. Please try again.", 500);
  }

  return ok({ email });
}
