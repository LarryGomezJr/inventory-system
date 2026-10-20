"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { requestJson } from "@/lib/http";
import type { Supplier } from "@/lib/suppliers";

export function DeleteSupplierDialog({
  supplier,
  onOpenChange,
  onDeleted,
  onSessionExpired,
}: {
  supplier: Supplier | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (supplier: Supplier) => void;
  onSessionExpired: () => void;
}) {
  const [pending, setPending] = React.useState(false);

  async function confirm(e: React.MouseEvent) {
    e.preventDefault(); // keep the dialog open until the request finishes
    if (!supplier) return;
    setPending(true);
    const res = await requestJson("DELETE", `/api/suppliers/${supplier.id}`);
    setPending(false);

    if (res.ok || res.code === "NOT_FOUND") {
      toast.success(`"${supplier.name}" deleted`);
      onDeleted(supplier);
      onOpenChange(false);
      return;
    }
    if (res.code === "SESSION_EXPIRED") return onSessionExpired();
    toast.error(res.error);
  }

  const count = supplier?.productCount ?? 0;

  return (
    <AlertDialog open={supplier !== null} onOpenChange={(open) => !pending && onOpenChange(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{supplier?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            {count > 0
              ? `${count} product${count === 1 ? " uses" : "s use"} this supplier. ${
                  count === 1 ? "It" : "They"
                }'ll be kept without a supplier. `
              : ""}
            This can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
