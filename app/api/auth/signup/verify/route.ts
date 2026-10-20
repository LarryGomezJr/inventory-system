import { fail, ok, parseBody } from "@/lib/api";
import { touchActivity } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { verifyEmailSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const parsed = await parseBody(request, verifyEmailSchema);
  if ("response" in parsed) return parsed.response;
  const { email, token } = parsed.data;

  // Cookie-bound client: a successful verification signs the user in.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });

  if (error || !data.user) {
    return fail("That code is invalid or has expired.", 400, {
      fieldErrors: { token: "Invalid or expired code" },
    });
  }

  await touchActivity(data.user.id);
  return ok({ redirectTo: "/dashboard" });
}
