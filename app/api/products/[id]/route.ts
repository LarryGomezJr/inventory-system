import { fail, ok, parseBody } from "@/lib/api";
import { PRODUCT_COLUMNS, productSchema, toProduct, toRow, type ProductRow } from "@/lib/products";
import { UUID_RE as UUID } from "@/lib/form-fields";
import { requireSession } from "@/lib/session";
import { checkSupplierAccess } from "@/lib/suppliers-server";

const notFound = () => fail("That product no longer exists.", 404, { code: "NOT_FOUND" });

export async function PATCH(request: Request, ctx: RouteContext<"/api/products/[id]">) {
  const session = await requireSession();
  if (session.response) return session.response;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return notFound();

  const parsed = await parseBody(request, productSchema);
  if ("response" in parsed) return parsed.response;

  const supplierError = await checkSupplierAccess(session.supabase, parsed.data.supplierId);
  if (supplierError) return supplierError;

  // RLS only matches the signed-in user's rows, so another user's id finds nothing.
  const { data, error } = await session.supabase
    .from("tbl_product")
    .update(toRow(parsed.data))
    .eq("id", id)
    .select(PRODUCT_COLUMNS)
    .maybeSingle<ProductRow>();

  if (error) {
    console.error("update product failed", error);
    return fail("Could not save the product. Please try again.", 500);
  }
  if (!data) return notFound();
  return ok({ product: toProduct(data) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/products/[id]">) {
  const session = await requireSession();
  if (session.response) return session.response;

  const { id } = await ctx.params;
  if (!UUID.test(id)) return notFound();

  const { data, error } = await session.supabase.from("tbl_product").delete().eq("id", id).select("id");
  if (error) {
    console.error("delete product failed", error);
    return fail("Could not delete the product. Please try again.", 500);
  }
  if (!data?.length) return notFound();
  return ok({ id });
}
