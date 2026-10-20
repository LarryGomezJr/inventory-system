import "server-only";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { fail } from "@/lib/api";
import {
  ACTIVITY_COOKIE,
  IDLE_TIMEOUT_SECONDS,
  activityCookieOptions,
  checkActivity,
  createActivityValue,
} from "@/lib/session-activity";
import { createClient } from "@/lib/supabase/server";

/** Starts or renews the idle-timeout window for a route handler response. */
export async function touchActivity(userId: string) {
  (await cookies()).set(ACTIVITY_COOKIE, await createActivityValue(userId), activityCookieOptions);
}

export async function readActivity(userId: string) {
  return checkActivity((await cookies()).get(ACTIVITY_COOKIE)?.value, userId);
}

export async function clearActivity() {
  (await cookies()).delete(ACTIVITY_COOKIE);
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Guard for API routes (the proxy doesn't run on /api): requires a signed-in
 * user whose idle window is still open, and renews that window.
 * Queries made with the returned client are scoped by RLS to this user.
 */
export async function requireSession(): Promise<
  { supabase: Supabase; user: User; response?: never } | { response: Response; supabase?: never; user?: never }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await clearActivity();
    return {
      response: fail("Your session has ended. Please sign in again.", 401, { code: "SESSION_EXPIRED" }),
    };
  }

  if ((await readActivity(user.id)) !== "active") {
    await supabase.auth.signOut({ scope: "local" });
    await clearActivity();
    const minutes = Math.round(IDLE_TIMEOUT_SECONDS / 60);
    return {
      response: fail(`You were signed out after ${minutes} minutes of inactivity.`, 401, {
        code: "SESSION_EXPIRED",
      }),
    };
  }

  await touchActivity(user.id);
  return { supabase, user };
}
