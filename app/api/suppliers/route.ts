import type { NextRequest } from "next/server";
import { fail, ok, parseBody } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { SUPPLIER_COLUMNS, supplierSchema, toSupplier, toSupplierRow, type SupplierRow } from "@/lib/suppliers";
import { duplicateName, isUniqueViolation, listSuppliers } from "@/lib/suppliers-server";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const params = request.nextUrl.searchParams;
  try {
    const data = await listSuppliers(session.supabase, {
      q: params.get("q") ?? "",
      category: params.get("category") ?? "",
      page: Number(params.get("page")) || 1,
    });
    return ok(data);
  } catch (err) {
    console.error("listSuppliers failed", err);
    return fail("Could not load suppliers. Please try again.", 500);
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const parsed = await parseBody(request, supplierSchema);
  if ("response" in parsed) return parsed.response;

  // user_id comes from the database default (auth.uid()), never from the client.
  const { data, error } = await session.supabase
    .from("tbl_supplier")
    .insert(toSupplierRow(parsed.data))
    .select(SUPPLIER_COLUMNS)
    .single<SupplierRow>();

  if (isUniqueViolation(error)) return duplicateName();
  if (error) {
    console.error("insert supplier failed", error);
    return fail("Could not save the supplier. Please try again.", 500);
  }
  return ok({ supplier: toSupplier(data) }, { status: 201 });
}
