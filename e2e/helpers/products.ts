import { admin } from "./supabase";

export type SeedProduct = {
  name: string;
  product_type?: string;
  quantity?: number;
  reorder_level?: number;
  expiration_date?: string | null;
  /** Supplier name: linked to the user's supplier, created if it doesn't exist. */
  supplier?: string | null;
};

export type SeedSupplier = {
  name: string;
  category?: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
};

/**
 * Inserts suppliers for a user (service role, bypasses RLS), returned in the
 * given order.
 */
export async function seedSuppliers(userId: string, items: SeedSupplier[]) {
  const rows = items.map((s) => ({
    user_id: userId,
    name: s.name,
    category: s.category ?? "Office Supplies",
    contact_person: s.contact_person ?? null,
    phone: s.phone ?? null,
    email: s.email ?? null,
  }));
  const { data, error } = await admin.from("tbl_supplier").insert(rows).select("id, name");
  if (error) throw error;
  const byName = new Map((data as { id: string; name: string }[]).map((r) => [r.name, r]));
  return items.map((s) => byName.get(s.name)!);
}

async function supplierIdsFor(userId: string, names: string[]) {
  const unique = [...new Set(names)];
  if (unique.length === 0) return new Map<string, string>();
  const { data, error } = await admin.from("tbl_supplier").select("id, name").eq("user_id", userId).in("name", unique);
  if (error) throw error;
  const ids = new Map((data as { id: string; name: string }[]).map((r) => [r.name, r.id]));
  const missing = unique.filter((n) => !ids.has(n));
  if (missing.length) {
    for (const s of await seedSuppliers(userId, missing.map((name) => ({ name })))) ids.set(s.name, s.id);
  }
  return ids;
}

/**
 * Inserts products for a user (service role, bypasses RLS). Rows get
 * created_at one second apart in the given order, so the newest-first table
 * order is deterministic: the LAST item is shown first.
 */
export async function seedProducts(userId: string, items: SeedProduct[]) {
  const suppliers = await supplierIdsFor(
    userId,
    items.map((p) => p.supplier).filter((n): n is string => !!n),
  );
  const base = Date.now() - items.length * 1000;
  const rows = items.map((p, i) => ({
    user_id: userId,
    name: p.name,
    product_type: p.product_type ?? "Office Supplies",
    quantity: p.quantity ?? 50,
    reorder_level: p.reorder_level ?? 10,
    expiration_date: p.expiration_date ?? null,
    supplier_id: p.supplier ? suppliers.get(p.supplier)! : null,
    created_at: new Date(base + i * 1000).toISOString(),
  }));
  const { data, error } = await admin.from("tbl_product").insert(rows).select("id, name");
  if (error) throw error;
  return data as { id: string; name: string }[];
}

export async function clearProducts(userId: string) {
  const { error } = await admin.from("tbl_product").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function clearSuppliers(userId: string) {
  const { error } = await admin.from("tbl_supplier").delete().eq("user_id", userId);
  if (error) throw error;
}

export async function getProductRow(id: string) {
  const { data, error } = await admin.from("tbl_product").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

export async function getSupplierRow(id: string) {
  const { data, error } = await admin.from("tbl_supplier").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

export async function findProductByName(userId: string, name: string) {
  const { data, error } = await admin
    .from("tbl_product")
    .select("*")
    .eq("user_id", userId)
    .eq("name", name)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}

export async function findSupplierByName(userId: string, name: string) {
  const { data, error } = await admin
    .from("tbl_supplier")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", name)
    .maybeSingle();
  if (error) throw error;
  return data as Record<string, unknown> | null;
}
