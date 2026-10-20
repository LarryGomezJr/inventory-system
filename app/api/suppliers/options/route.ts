import { fail, ok } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { listSupplierOptions } from "@/lib/suppliers-server";

/** All of the user's suppliers, for the product form's Supplier dropdown. */
export async function GET() {
  const session = await requireSession();
  if (session.response) return session.response;

  try {
    return ok({ options: await listSupplierOptions(session.supabase) });
  } catch (err) {
    console.error("listSupplierOptions failed", err);
    return fail("Could not load suppliers. Please try again.", 500);
  }
}
