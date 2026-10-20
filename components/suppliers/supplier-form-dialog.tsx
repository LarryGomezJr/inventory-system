"use client";

import * as React from "react";
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
import { SUPPLIER_CATEGORIES, supplierSchema, type Supplier } from "@/lib/suppliers";
import { toFieldErrors, type FieldErrors } from "@/lib/validations/auth";

type FormValues = { name: string; category: string; contactPerson: string; phone: string; email: string };

const empty: FormValues = { name: "", category: "", contactPerson: "", phone: "", email: "" };

function fromSupplier(s: Supplier): FormValues {
  return {
    name: s.name,
    category: s.category,
    contactPerson: s.contactPerson ?? "",
    phone: s.phone ?? "",
    email: s.email ?? "",
  };
}

export function SupplierFormDialog({
  open,
  onOpenChange,
  supplier,
  onSaved,
  onSessionExpired,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  supplier: Supplier | null;
  onSaved: (supplier: Supplier, mode: "create" | "edit") => void;
  onSessionExpired: () => void;
}) {
  const editing = supplier !== null;
  const [values, setValues] = React.useState<FormValues>(empty);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Reset the form each time the dialog opens.
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  const key = open ? (supplier?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setValues(supplier ? fromSupplier(supplier) : empty);
      setErrors({});
      setFormError(null);
    }
  }

  const set = (field: keyof FormValues, value: string) => {
    setValues((v) => ({ ...v, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = supplierSchema.safeParse(values);
    if (!parsed.success) return setErrors(toFieldErrors(parsed.error));

    setPending(true);
    const res = editing
      ? await requestJson<{ supplier: Supplier }>("PATCH", `/api/suppliers/${supplier.id}`, values)
      : await requestJson<{ supplier: Supplier }>("POST", "/api/suppliers", values);
    setPending(false);

    if (res.ok) {
      toast.success(editing ? `"${res.supplier.name}" updated` : `"${res.supplier.name}" added`);
      onSaved(res.supplier, editing ? "edit" : "create");
      onOpenChange(false);
      return;
    }
    if (res.code === "SESSION_EXPIRED") return onSessionExpired();
    if (!res.fieldErrors) setFormError(res.error);
    setErrors(res.fieldErrors ?? {});
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit supplier" : "Add supplier"}</DialogTitle>
          <DialogDescription>
            {editing ? "Update the supplier's details." : "Save a supplier's contact details."}
          </DialogDescription>
        </DialogHeader>

        <form id="supplier-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          {formError && (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          )}
          <FormField
            id="supplier-name"
            label="Supplier name"
            placeholder="e.g. Acme Trading"
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
            autoFocus
          />
          <div className="grid gap-1.5">
            <Label htmlFor="supplier-category">Category</Label>
            <Select value={values.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger id="supplier-category" aria-invalid={!!errors.category} className="h-10 w-full bg-card">
                <SelectValue placeholder="What do they supply?" />
              </SelectTrigger>
              <SelectContent position="popper">
                {SUPPLIER_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
          </div>
          <FormField
            id="supplier-contact"
            label="Contact person (optional)"
            placeholder="e.g. Maria Santos"
            autoComplete="off"
            value={values.contactPerson}
            onChange={(e) => set("contactPerson", e.target.value)}
            error={errors.contactPerson}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              id="supplier-phone"
              label="Phone (optional)"
              type="tel"
              inputMode="tel"
              placeholder="+63 912 345 6789"
              autoComplete="off"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              error={errors.phone}
            />
            <FormField
              id="supplier-email"
              label="Email (optional)"
              type="email"
              placeholder="orders@supplier.com"
              autoComplete="off"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              error={errors.email}
            />
          </div>
        </form>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="supplier-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {editing ? "Save changes" : "Add supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
