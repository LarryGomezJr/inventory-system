import { z } from "zod";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Optional text field: trimmed, empty → null. */
export const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => v?.trim() ?? "")
    .refine((v) => v.length <= max, `At most ${max} characters`)
    .transform((v) => v || null);

/** Optional reference to another record: a UUID, or empty / null for "none". */
export const optionalId = (message: string) =>
  z
    .string()
    .nullish()
    .transform((v) => v?.trim() || null)
    .refine((v) => v === null || UUID_RE.test(v), message);

/** Makes user input safe inside a PostgREST `or()` ilike filter. */
export function searchPattern(q: string) {
  const cleaned = q.replace(/[,()"\\*:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  if (!cleaned) return null;
  return `%${cleaned.replace(/[%_]/g, (m) => `\\${m}`)}%`;
}
