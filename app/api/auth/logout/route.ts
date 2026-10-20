import { ok } from "@/lib/api";
import { clearActivity } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearActivity();
  return ok({ redirectTo: "/login" });
}
