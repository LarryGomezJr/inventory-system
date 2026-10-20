import { z } from "zod";
import { optionalId, optionalText } from "@/lib/form-fields";

export const PRODUCT_TYPES = [
  "Food & Beverage",
  "Medicine",
  "Electronics",
  "Office Supplies",
  "Cleaning Supplies",
  "Hardware",
  "Other",
] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const STOCK_STATUS_LABELS = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
} as const;
export type StockStatus = keyof typeof STOCK_STATUS_LABELS;

/** Table filters. "low_stock" includes out-of-stock items (both need restocking). */
export const PRODUCT_FILTERS = {
  all: "All products",
  low_stock: "Needs restock",
  out_of_stock: "Out of stock",
  expiring: "Expiring / expired",
} as const;
export type ProductFilter = keyof typeof PRODUCT_FILTERS;

export const PAGE_SIZE = 10;
export const EXPIRING_SOON_DAYS = 30;
const MAX_QTY = 1_000_000;

/** Whole number from a form field ("" → "Enter the …", not 0). */
const count = (label: string) => {
  const Label = label[0].toUpperCase() + label.slice(1);
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : typeof v === "string" ? Number(v) : v),
    z
      .number({ error: `Enter the ${label}` })
      .int(`${Label} must be a whole number`)
      .min(0, `${Label} can't be negative`)
      .max(MAX_QTY, `${Label} is too large`),
  );
};

export const productSchema = z.object({
  name: z.string().trim().min(1, "Enter the product name").max(120, "At most 120 characters"),
  productType: z.enum(PRODUCT_TYPES, { error: "Choose a product type" }),
  quantity: count("quantity"),
  reorderLevel: count("reorder level"),
  expirationDate: optionalText(10).refine((v) => v === null || isValidIsoDate(v), "Enter a valid date"),
  supplierId: optionalId("Choose a supplier from your list"),
});
export type ProductInput = z.input<typeof productSchema>;
export type ProductValues = z.output<typeof productSchema>;

export type Product = {
  id: string;
  name: string;
  productType: ProductType;
  quantity: number;
  reorderLevel: number;
  expirationDate: string | null;
  supplierId: string | null;
  supplierName: string | null;
  stockStatus: StockStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProductRow = {
  id: string;
  name: string;
  product_type: ProductType;
  quantity: number;
  reorder_level: number;
  expiration_date: string | null;
  supplier_id: string | null;
  /** Many-to-one embed: an object at runtime (typed loosely by supabase-js). */
  supplier: { id: string; name: string } | { id: string; name: string }[] | null;
  stock_status: StockStatus;
  created_at: string;
  updated_at: string;
};

export const PRODUCT_COLUMNS =
  "id, name, product_type, quantity, reorder_level, expiration_date, supplier_id, stock_status, created_at, updated_at, supplier:tbl_supplier(id, name)";

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    productType: row.product_type,
    quantity: row.quantity,
    reorderLevel: row.reorder_level,
    expirationDate: row.expiration_date,
    supplierId: row.supplier_id,
    supplierName: (Array.isArray(row.supplier) ? row.supplier[0]?.name : row.supplier?.name) ?? null,
    stockStatus: row.stock_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toRow(values: ProductValues) {
  return {
    name: values.name,
    product_type: values.productType,
    quantity: values.quantity,
    reorder_level: values.reorderLevel,
    expiration_date: values.expirationDate,
    supplier_id: values.supplierId,
  };
}

export type ProductSummary = {
  total: number;
  lowStock: number;
  outOfStock: number;
  expiringSoon: number;
  expired: number;
  alerts: Pick<Product, "id" | "name" | "quantity" | "reorderLevel" | "stockStatus">[];
};

export type ProductListResponse = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  summary: ProductSummary;
  /** Set when the list is filtered to one supplier. */
  supplierFilter: { id: string; name: string } | null;
};

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** YYYY-MM-DD for "today + offset days" in local time. */
export function isoDate(offsetDays = 0, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export type ExpiryStatus = { kind: "none" | "ok" | "expiring" | "expired"; days: number | null };

export function expiryStatus(expirationDate: string | null, today = isoDate()): ExpiryStatus {
  if (!expirationDate) return { kind: "none", days: null };
  const ms = Date.parse(`${expirationDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  const days = Math.round(ms / 86_400_000);
  if (days < 0) return { kind: "expired", days };
  if (days <= EXPIRING_SOON_DAYS) return { kind: "expiring", days };
  return { kind: "ok", days };
}

export function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
