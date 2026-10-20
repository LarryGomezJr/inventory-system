import "server-only";
import { cache } from "react";
import { getCurrentUser } from "@/lib/auth";
import { PRODUCT_COLUMNS, toProduct, type ProductRow } from "@/lib/products";
import { getProductSummary } from "@/lib/products-server";
import { createClient } from "@/lib/supabase/server";

/**
 * Data for the dashboard home. Request-time only (getCurrentUser calls
 * connection()), and RLS limits every query to the signed-in user.
 * Render callers inside <Suspense>.
 */
export const getInventoryOverview = cache(async () => {
  await getCurrentUser();
  const supabase = await createClient();

  const [summary, recent] = await Promise.all([
    getProductSummary(supabase),
    supabase
      .from("tbl_product")
      .select(PRODUCT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (recent.error) throw recent.error;

  return { summary, recent: (recent.data as unknown as ProductRow[]).map(toProduct) };
});
