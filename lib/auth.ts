import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  username: string;
  phone: string;
};

/**
 * Data Access Layer: resolves the signed-in user (and profile) or redirects.
 * Reads cookies, so callers must render inside a <Suspense> boundary.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser> => {
  // Who is signed in must never be prerendered or prefetch-cached. This also
  // keeps Supabase's Date.now() session-expiry checks out of the prerender.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row } = await supabase
    .from("tbl_user")
    .select("full_name, username, phone_number")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: user.email ?? "",
    fullName: row?.full_name || user.user_metadata?.full_name || "User",
    username: row?.username || user.user_metadata?.username || "",
    phone: row?.phone_number || user.user_metadata?.phone || "",
  };
});
