import { fail, ok, parseBody } from "@/lib/api";
import { createStatelessClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const parsed = await parseBody(request, resetPasswordSchema);
  if ("response" in parsed) return parsed.response;
  const { email, token, password } = parsed.data;

  // Stateless: the recovery session only lives for this request.
  const supabase = createStatelessClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "recovery",
  });
  if (verifyError) {
    return fail("That code is invalid or has expired.", 400, {
      fieldErrors: { token: "Invalid or expired code" },
    });
  }

  const { error: updateError } = await supabase.auth.updateUser({ password });
  if (updateError) {
    const message =
      updateError.code === "same_password"
        ? "New password must be different from the old one."
        : updateError.message;
    return fail(message, 400, { fieldErrors: { password: message } });
  }

  // Sign out every device after a password change.
  await supabase.auth.signOut({ scope: "global" });

  return ok({ redirectTo: "/login?reset=1" });
}
