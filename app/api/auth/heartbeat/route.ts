import { ok } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { IDLE_TIMEOUT_SECONDS } from "@/lib/session-activity";

/**
 * Called by the dashboard while the user is active. Refreshes the Supabase
 * session if its 30-minute JWT is close to expiring and restarts the idle window.
 */
export async function POST() {
  const session = await requireSession();
  if (session.response) return session.response;
  return ok({ idleTimeoutSeconds: IDLE_TIMEOUT_SECONDS });
}
