import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail } from "@/lib/api";
import { searchPattern } from "@/lib/form-fields";
import {
  SUPPLIER_CATEGORIES,
  SUPPLIER_COLUMNS,
  SUPPLIER_PAGE_SIZE,
  toSupplier,
  type SupplierCategory,
  type SupplierListResponse,
  type SupplierOption,
  type SupplierRow,
} from "@/lib/suppliers";

// Queries use the caller's cookie-bound client, so RLS limits them to the
// signed-in user's suppliers.

export async function listSuppliers(
  supabase: SupabaseClient,
  opts: { q?: string; category?: string; page?: number },
): Promise<SupplierListResponse> {
  const pattern = searchPattern(opts.q ?? "");
  const category = SUPPLIER_CATEGORIES.includes(opts.category as SupplierCategory) ? opts.category : null;

  const run = (page: number) => {
    let query = supabase.from("tbl_supplier").select(SUPPLIER_COLUMNS, { count: "exact" });
    if (pattern) {
      query = query.or(
        `name.ilike.${pattern},contact_person.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
      );
    }
    if (category) query = query.eq("category", category);
    const from = (page - 1) * SUPPLIER_PAGE_SIZE;
    return query
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + SUPPLIER_PAGE_SIZE - 1);
  };

  let page = Math.max(1, Math.floor(opts.page ?? 1));
  let result = await run(page);
  if (!result.error && (result.data?.length ?? 0) === 0 && (result.count ?? 0) > 0 && page > 1) {
    page = Math.max(1, Math.ceil((result.count ?? 0) / SUPPLIER_PAGE_SIZE));
    result = await run(page);
  }
  if (result.error) throw result.error;

  return {
    items: (result.data as unknown as SupplierRow[]).map(toSupplier),
    total: result.count ?? 0,
    page,
    pageSize: SUPPLIER_PAGE_SIZE,
  };
}

export async function listSupplierOptions(supabase: SupabaseClient): Promise<SupplierOption[]> {
  const { data, error } = await supabase
    .from("tbl_supplier")
    .select("id, name, category")
    .order("name", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as SupplierOption[];
}

/**
 * For product writes: the supplier must be one of the user's own. RLS hides
 * other users' suppliers (and the composite foreign key enforces it too).
 */
export async function checkSupplierAccess(supabase: SupabaseClient, supplierId: string | null) {
  if (!supplierId) return null;
  const { data, error } = await supabase.from("tbl_supplier").select("id").eq("id", supplierId).maybeSingle();
  if (error) throw error;
  if (data) return null;
  return fail("Please fix the highlighted fields", 400, {
    fieldErrors: { supplierId: "Choose a supplier from your list" },
  });
}

export const isUniqueViolation = (error: { code?: string } | null) => error?.code === "23505";

export const duplicateName = () =>
  fail("You already have a supplier with this name.", 409, {
    fieldErrors: { name: "You already have a supplier with this name" },
  });
