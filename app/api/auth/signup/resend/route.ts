import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { createStatelessClient } from "@/lib/supabase/server";
import { emailSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const parsed = await parseBody(request, z.object({ email: emailSchema }));
  if ("response" in parsed) return parsed.response;

  const { error } = await createStatelessClient().auth.resend({
    type: "signup",
    email: parsed.data.email,
  });

  if (error) {
    if (error.status === 429) {
      return fail("Please wait a moment before requesting another code.", 429);
    }
    console.error("resend signup failed", error);
    return fail("Could not resend the code. Please try again.", 500);
  }

  return ok();
}
