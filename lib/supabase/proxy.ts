import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  ACTIVITY_COOKIE,
  activityCookieOptions,
  checkActivity,
  createActivityValue,
} from "@/lib/session-activity";
import { supabaseCookieOptions } from "./cookies";

const AUTH_PAGES = [
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];
const PROTECTED_PREFIXES = ["/dashboard"];

/**
 * Refreshes the Supabase session cookie, enforces the idle timeout and
 * protects routes.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: supabaseCookieOptions,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser().
  const {
    data: { user: sessionUser },
  } = await supabase.auth.getUser();
  let user = sessionUser;

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => pathname.startsWith(p));

  let expired = false;
  if (user) {
    const status = await checkActivity(request.cookies.get(ACTIVITY_COOKIE)?.value, user.id);
    if (status === "active") {
      // Sliding window: every request while active restarts the 30 minutes.
      response.cookies.set(ACTIVITY_COOKIE, await createActivityValue(user.id), activityCookieOptions);
    } else {
      // Idle too long (or tampered cookie): revoke the refresh token and clear cookies.
      await supabase.auth.signOut({ scope: "local" });
      response.cookies.set(ACTIVITY_COOKIE, "", { ...activityCookieOptions, maxAge: 0 });
      user = null;
      expired = true;
    }
  }

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = expired ? "?expired=1" : "";
    const redirect = NextResponse.redirect(url);
    // Carry over refreshed or cleared auth cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && (isProtected || pathname === "/")) {
    return redirectTo("/login");
  }

  // reset-password must stay reachable while a recovery session is active.
  if (user && isAuthPage && !pathname.startsWith("/reset-password")) {
    return redirectTo("/dashboard");
  }

  if (user && pathname === "/") {
    return redirectTo("/dashboard");
  }

  return response;
}
