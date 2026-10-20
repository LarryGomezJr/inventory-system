import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Supabase defaults to httpOnly: false so a browser client can read the
 * session. All auth here runs on the server, so lock the token cookies down:
 * page JavaScript (including any injected script) can't read them.
 */
export const supabaseCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};
