import type { NextRequest } from "next/server";
import { fail, ok, parseBody } from "@/lib/api";
import {
  PRODUCT_COLUMNS,
  PRODUCT_FILTERS,
  productSchema,
  toProduct,
  toRow,
  type ProductFilter,
  type ProductRow,
} from "@/lib/products";
import { listProducts } from "@/lib/products-server";
import { requireSession } from "@/lib/session";
import { checkSupplierAccess } from "@/lib/suppliers-server";

export async function GET(request: NextRequest) {
  const session = await requireSession();
  if (session.response) return session.response;

  const params = request.nextUrl.searchParams;
  const status = params.get("status") ?? "all";
  const filter: ProductFilter = status in PRODUCT_FILTERS ? (status as ProductFilter) : "all";

  try {
    const data = await listProducts(session.supabase, {
      q: params.get("q") ?? "",
      filter,
      page: Number(params.get("page")) || 1,
      supplierId: params.get("supplier"),
    });
    return ok(data);
  } catch (err) {
    console.error("listProducts failed", err);
    return fail("Could not load products. Please try again.", 500);
  }
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (session.response) return session.response;

  const parsed = await parseBody(request, productSchema);
  if ("response" in parsed) return parsed.response;

  const supplierError = await checkSupplierAccess(session.supabase, parsed.data.supplierId);
  if (supplierError) return supplierError;

  // user_id comes from the database default (auth.uid()), never from the client.
  const { data, error } = await session.supabase
    .from("tbl_product")
    .insert(toRow(parsed.data))
    .select(PRODUCT_COLUMNS)
    .single<ProductRow>();

  if (error) {
    console.error("insert product failed", error);
    return fail("Could not save the product. Please try again.", 500);
  }
  return ok({ product: toProduct(data) }, { status: 201 });
}
