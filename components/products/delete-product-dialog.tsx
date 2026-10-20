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
import type { Product } from "@/lib/products";

export function DeleteProductDialog({
  product,
  onOpenChange,
  onDeleted,
  onSessionExpired,
}: {
  product: Product | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: (product: Product) => void;
  onSessionExpired: () => void;
}) {
  const [pending, setPending] = React.useState(false);

  async function confirm(e: React.MouseEvent) {
    e.preventDefault(); // keep the dialog open until the request finishes
    if (!product) return;
    setPending(true);
    const res = await requestJson("DELETE", `/api/products/${product.id}`);
    setPending(false);

    if (res.ok || res.code === "NOT_FOUND") {
      toast.success(`"${product.name}" deleted`);
      onDeleted(product);
      onOpenChange(false);
      return;
    }
    if (res.code === "SESSION_EXPIRED") return onSessionExpired();
    toast.error(res.error);
  }

  return (
    <AlertDialog open={product !== null} onOpenChange={(open) => !pending && onOpenChange(open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{product?.name}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the product from your inventory. This can&apos;t be undone.
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
