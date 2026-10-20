"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { FormField } from "@/components/auth/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestJson } from "@/lib/http";
import { PRODUCT_TYPES, productSchema, type Product } from "@/lib/products";
import type { SupplierOption } from "@/lib/suppliers";
import { toFieldErrors, type FieldErrors } from "@/lib/validations/auth";

const NO_SUPPLIER = "__none__";

type FormValues = {
  name: string;
  productType: string;
  quantity: string;
  reorderLevel: string;
  expirationDate: string;
  supplierId: string;
};

const empty: FormValues = {
  name: "",
  productType: "",
  quantity: "",
  reorderLevel: "10",
  expirationDate: "",
  supplierId: "",
};

function fromProduct(p: Product): FormValues {
  return {
    name: p.name,
    productType: p.productType,
    quantity: String(p.quantity),
    reorderLevel: String(p.reorderLevel),
    expirationDate: p.expirationDate ?? "",
    supplierId: p.supplierId ?? "",
  };
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
  onSessionExpired,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  product: Product | null;
  onSaved: (product: Product, mode: "create" | "edit") => void;
  onSessionExpired: () => void;
}) {
  const editing = product !== null;
  const [values, setValues] = React.useState<FormValues>(empty);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Reset the form each time the dialog opens.
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  const key = open ? (product?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setValues(product ? fromProduct(product) : empty);
      setErrors({});
      setFormError(null);
    }
  }

  // The user's suppliers for the dropdown, loaded each time the dialog opens.
  const [suppliers, setSuppliers] = React.useState<SupplierOption[] | null>(null);
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    requestJson<{ options: SupplierOption[] }>("GET", "/api/suppliers/options").then((res) => {
      if (cancelled) return;
      if (res.ok) setSuppliers(res.options);
      else if (res.code === "SESSION_EXPIRED") onSessionExpired();
      else setSuppliers([]);
    });
    return () => {
      cancelled = true;
    };
  }, [open, onSessionExpired]);

  const set = (field: keyof FormValues, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = productSchema.safeParse(values);
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));

    setPending(true);
    const res = editing
      ? await requestJson<{ product: Product }>("PATCH", `/api/products/${product.id}`, values)
      : await requestJson<{ product: Product }>("POST", "/api/products", values);
    setPending(false);

    if (res.ok) {
      toast.success(editing ? `"${res.product.name}" updated` : `"${res.product.name}" added`);
      onSaved(res.product, editing ? "edit" : "create");
      onOpenChange(false);
      return;
    }
    if (res.code === "SESSION_EXPIRED") return onSessionExpired();
    setFormError(res.error);
    setErrors(res.fieldErrors ?? {});
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the product details." : "Fill in the details of the new product."}
          </DialogDescription>
        </DialogHeader>

        <form id="product-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          {formError && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <FormField
            id="product-name"
            label="Product name"
            placeholder="e.g. Printer Ink Black"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
            autoFocus
          />
          <div className="grid gap-1.5">
            <Label htmlFor="product-type">Type of product</Label>
            <Select value={values.productType} onValueChange={(v) => set("productType", v)}>
              <SelectTrigger
                id="product-type"
                aria-invalid={!!errors.productType}
                className="h-10 w-full bg-card"
              >
                <SelectValue placeholder="Choose a type" />
              </SelectTrigger>
              <SelectContent position="popper">
                {PRODUCT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.productType && <p className="text-xs text-destructive">{errors.productType}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="product-quantity"
              label="Quantity"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              placeholder="0"
              value={values.quantity}
              onChange={(e) => set("quantity", e.target.value)}
              error={errors.quantity}
            />
            <FormField
              id="product-reorder"
              label="Reorder level"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={values.reorderLevel}
              onChange={(e) => set("reorderLevel", e.target.value)}
              error={errors.reorderLevel}
              hint="Low stock at or below this"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="product-expiration"
              label="Expiration date (optional)"
              type="date"
              value={values.expirationDate}
              onChange={(e) => set("expirationDate", e.target.value)}
              error={errors.expirationDate}
            />
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="product-supplier">Supplier (optional)</Label>
                <Link href="/dashboard/suppliers" className="text-xs font-medium text-accent-foreground/80 hover:underline">
                  Manage suppliers
                </Link>
              </div>
              <Select
                value={values.supplierId || NO_SUPPLIER}
                onValueChange={(v) => set("supplierId", v === NO_SUPPLIER ? "" : v)}
                disabled={!suppliers}
              >
                <SelectTrigger id="product-supplier" aria-invalid={!!errors.supplierId} className="h-10 w-full bg-card">
                  <SelectValue placeholder={suppliers ? "No supplier" : "Loading suppliers…"} />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value={NO_SUPPLIER}>No supplier</SelectItem>
                  {suppliers?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      <span className="text-xs text-muted-foreground">· {s.category}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.supplierId ? (
                <p className="text-xs text-destructive">{errors.supplierId}</p>
              ) : suppliers?.length === 0 ? (
                <p className="text-xs text-muted-foreground">No suppliers yet — add one on the Suppliers page.</p>
              ) : null}
            </div>
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
