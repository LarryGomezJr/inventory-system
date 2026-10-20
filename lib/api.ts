import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { toFieldErrors, type FieldErrors } from "@/lib/validations/auth";

export type ApiResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; error: string; fieldErrors?: FieldErrors; code?: string };

export function ok<T extends Record<string, unknown>>(data?: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...(data ?? {}) }, init);
}

export function fail(
  error: string,
  status = 400,
  extra?: { fieldErrors?: FieldErrors; code?: string },
) {
  return NextResponse.json({ ok: false, error, ...extra }, { status });
}

/** Parses a JSON body against a schema, returning a 400 response on failure. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ data: z.infer<S> } | { response: NextResponse }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: fail("Invalid request body") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: fail("Please fix the highlighted fields", 400, {
        fieldErrors: toFieldErrors(parsed.error),
      }),
    };
  }
  return { data: parsed.data };
}
