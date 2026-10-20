import { ok, parseBody } from "@/lib/api";
import { createStatelessClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const parsed = await parseBody(request, forgotPasswordSchema);
  if ("response" in parsed) return parsed.response;

  const { error } = await createStatelessClient().auth.resetPasswordForEmail(
    parsed.data.email,
  );
  if (error) console.error("resetPasswordForEmail failed", error);

  // Same response whether or not the account exists (no account enumeration).
  return ok({ email: parsed.data.email });
}
