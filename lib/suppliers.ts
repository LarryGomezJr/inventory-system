import { z } from "zod";
import { optionalText } from "@/lib/form-fields";
import { PAGE_SIZE, PRODUCT_TYPES, type ProductType } from "@/lib/products";

/** Suppliers use the same categories as products. */
export const SUPPLIER_CATEGORIES = PRODUCT_TYPES;
export type SupplierCategory = ProductType;
export const SUPPLIER_PAGE_SIZE = PAGE_SIZE;

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Enter the supplier name").max(120, "At most 120 characters"),
  category: z.enum(SUPPLIER_CATEGORIES, { error: "Choose a category" }),
  contactPerson: optionalText(120),
  phone: optionalText(30).refine(
    (v) => v === null || /^\+?[0-9\s\-()]{7,20}$/.test(v),
    "Enter a valid phone number",
  ),
  email: optionalText(254)
    .transform((v) => v?.toLowerCase() ?? null)
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address"),
});
export type SupplierValues = z.output<typeof supplierSchema>;

export type Supplier = {
  id: string;
  name: string;
  category: SupplierCategory;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SupplierOption = Pick<Supplier, "id" | "name" | "category">;

export type SupplierRow = {
  id: string;
  name: string;
  category: SupplierCategory;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
  products?: { count: number }[];
};

/** Includes how many of the user's products use each supplier (RLS-scoped count). */
export const SUPPLIER_COLUMNS =
  "id, name, category, contact_person, phone, email, created_at, updated_at, products:tbl_product(count)";

export function toSupplier(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    contactPerson: row.contact_person,
    phone: row.phone,
    email: row.email,
    productCount: row.products?.[0]?.count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toSupplierRow(values: SupplierValues) {
  return {
    name: values.name,
    category: values.category,
    contact_person: values.contactPerson,
    phone: values.phone,
    email: values.email,
  };
}

export type SupplierListResponse = {
  items: Supplier[];
  total: number;
  page: number;
  pageSize: number;
};
