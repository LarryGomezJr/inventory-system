import { fail, ok, parseBody } from "@/lib/api";
import { UUID_RE } from "@/lib/form-fields";
import { requireSession } from "@/lib/session";
import { SUPPLIER_COLUMNS, supplierSchema, toSupplier, toSupplierRow, type SupplierRow } from "@/lib/suppliers";
import { duplicateName, isUniqueViolation } from "@/lib/suppliers-server";

const notFound = () => fail("That supplier no longer exists.", 404, { code: "NOT_FOUND" });

export async function PATCH(request: Request, ctx: RouteContext<"/api/suppliers/[id]">) {
  const session = await requireSession();
  if (session.response) return session.response;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound();

  const parsed = await parseBody(request, supplierSchema);
  if ("response" in parsed) return parsed.response;

  // RLS only matches the signed-in user's rows, so another user's id finds nothing.
  const { data, error } = await session.supabase
    .from("tbl_supplier")
    .update(toSupplierRow(parsed.data))
    .eq("id", id)
    .select(SUPPLIER_COLUMNS)
    .maybeSingle<SupplierRow>();

  if (isUniqueViolation(error)) return duplicateName();
  if (error) {
    console.error("update supplier failed", error);
    return fail("Could not save the supplier. Please try again.", 500);
  }
  if (!data) return notFound();
  return ok({ supplier: toSupplier(data) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/suppliers/[id]">) {
  const session = await requireSession();
  if (session.response) return session.response;

  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return notFound();

  const { count } = await session.supabase
    .from("tbl_product")
    .select("id", { count: "exact", head: true })
    .eq("supplier_id", id);

  // Linked products are kept; the foreign key clears their supplier_id.
  const { data, error } = await session.supabase.from("tbl_supplier").delete().eq("id", id).select("id");
  if (error) {
    console.error("delete supplier failed", error);
    return fail("Could not delete the supplier. Please try again.", 500);
  }
  if (!data?.length) return notFound();
  return ok({ id, unlinkedProducts: count ?? 0 });
}
