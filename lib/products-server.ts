import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { UUID_RE, searchPattern } from "@/lib/form-fields";
import {
  EXPIRING_SOON_DAYS,
  PAGE_SIZE,
  PRODUCT_COLUMNS,
  isoDate,
  toProduct,
  type ProductFilter,
  type ProductListResponse,
  type ProductRow,
  type ProductSummary,
} from "@/lib/products";

// All queries use the caller's cookie-bound client, so RLS limits them to the
// signed-in user's rows. No user_id filters are needed (or trusted) here.

const NEEDS_RESTOCK = ["low_stock", "out_of_stock"];

export async function getProductSummary(supabase: SupabaseClient): Promise<ProductSummary> {
  const today = isoDate();
  const soon = isoDate(EXPIRING_SOON_DAYS);
  const count = () => supabase.from("tbl_product").select("id", { count: "exact", head: true });

  const [total, low, out, expiring, expired, alerts] = await Promise.all([
    count(),
    count().eq("stock_status", "low_stock"),
    count().eq("stock_status", "out_of_stock"),
    count().gte("expiration_date", today).lte("expiration_date", soon),
    count().lt("expiration_date", today),
    supabase
      .from("tbl_product")
      .select("id, name, quantity, reorder_level, stock_status")
      .in("stock_status", NEEDS_RESTOCK)
      .order("quantity", { ascending: true })
      .order("name", { ascending: true })
      .limit(5),
  ]);

  const firstError = [total, low, out, expiring, expired, alerts].find((r) => r.error)?.error;
  if (firstError) throw firstError;

  return {
    total: total.count ?? 0,
    lowStock: low.count ?? 0,
    outOfStock: out.count ?? 0,
    expiringSoon: expiring.count ?? 0,
    expired: expired.count ?? 0,
    alerts: (alerts.data ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      quantity: a.quantity,
      reorderLevel: a.reorder_level,
      stockStatus: a.stock_status,
    })),
  };
}

export async function listProducts(
  supabase: SupabaseClient,
  opts: { q?: string; filter?: ProductFilter; page?: number; supplierId?: string | null },
): Promise<ProductListResponse> {
  const pattern = searchPattern(opts.q ?? "");
  const filter = opts.filter ?? "all";
  const supplierId = opts.supplierId && UUID_RE.test(opts.supplierId) ? opts.supplierId : null;

  // Supplier names live in tbl_supplier, so look up matching supplier ids first.
  let supplierMatches: string[] = [];
  if (pattern) {
    const { data, error } = await supabase.from("tbl_supplier").select("id").ilike("name", pattern).limit(200);
    if (error) throw error;
    supplierMatches = (data ?? []).map((r) => r.id as string);
  }

  const run = (page: number) => {
    let query = supabase.from("tbl_product").select(PRODUCT_COLUMNS, { count: "exact" });
    if (pattern) {
      const bySupplier = supplierMatches.length ? `,supplier_id.in.(${supplierMatches.join(",")})` : "";
      query = query.or(`name.ilike.${pattern},product_type.ilike.${pattern}${bySupplier}`);
    }
    if (supplierId) query = query.eq("supplier_id", supplierId);
    if (filter === "low_stock") query = query.in("stock_status", NEEDS_RESTOCK);
    if (filter === "out_of_stock") query = query.eq("stock_status", "out_of_stock");
    if (filter === "expiring") {
      query = query
        .not("expiration_date", "is", null)
        .lte("expiration_date", isoDate(EXPIRING_SOON_DAYS))
        .order("expiration_date", { ascending: true });
    }
    const from = (page - 1) * PAGE_SIZE;
    return query
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
  };

  let page = Math.max(1, Math.floor(opts.page ?? 1));
  let result = await run(page);
  // Past the last page (e.g. after deleting its only row): show the last page instead.
  if (!result.error && (result.data?.length ?? 0) === 0 && (result.count ?? 0) > 0 && page > 1) {
    page = Math.max(1, Math.ceil((result.count ?? 0) / PAGE_SIZE));
    result = await run(page);
  }
  if (result.error) throw result.error;

  return {
    items: (result.data as unknown as ProductRow[]).map(toProduct),
    total: result.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    summary: await getProductSummary(supabase),
    supplierFilter: supplierId ? await supplierName(supabase, supplierId) : null,
  };
}

async function supplierName(supabase: SupabaseClient, id: string) {
  const { data } = await supabase.from("tbl_supplier").select("id, name").eq("id", id).maybeSingle();
  return (data as { id: string; name: string } | null) ?? null;
}
