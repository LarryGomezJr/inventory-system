/**
 * Idle-timeout cookie: `<userId>.<lastActiveMs>.<signature>`, HMAC-SHA256
 * signed with SESSION_SECRET. Renewed on every page request and heartbeat;
 * once it is older than the idle window the session is signed out.
 *
 * Uses Web Crypto so it runs in both the proxy and route handlers.
 */

export const ACTIVITY_COOKIE = "session_activity";

export const IDLE_TIMEOUT_SECONDS = (() => {
  const n = Number(process.env.SESSION_IDLE_SECONDS);
  return Number.isFinite(n) && n >= 60 ? Math.floor(n) : 30 * 60;
})();

export const activityCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: IDLE_TIMEOUT_SECONDS,
};

let keyPromise: Promise<CryptoKey> | null = null;

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set in .env.local (at least 32 characters)");
  }
  keyPromise ??= crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  return keyPromise;
}

function toBase64Url(bytes: ArrayBuffer) {
  let binary = "";
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

export async function createActivityValue(userId: string, now = Date.now()) {
  const payload = `${userId}.${now}`;
  const signature = await crypto.subtle.sign("HMAC", await getKey(), new TextEncoder().encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}

export type ActivityStatus = "active" | "missing" | "invalid" | "expired";

export async function checkActivity(
  value: string | undefined,
  userId: string,
  now = Date.now(),
): Promise<ActivityStatus> {
  if (!value) return "missing";

  const parts = value.split(".");
  if (parts.length !== 3) return "invalid";
  const [cookieUserId, lastActive, signature] = parts;

  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await getKey(),
      fromBase64Url(signature),
      new TextEncoder().encode(`${cookieUserId}.${lastActive}`),
    );
  } catch {
    return "invalid";
  }
  if (!valid || cookieUserId !== userId) return "invalid";

  const lastActiveMs = Number(lastActive);
  if (!Number.isFinite(lastActiveMs) || lastActiveMs > now + 60_000) return "invalid";
  if (now - lastActiveMs > IDLE_TIMEOUT_SECONDS * 1000) return "expired";
  return "active";
}
