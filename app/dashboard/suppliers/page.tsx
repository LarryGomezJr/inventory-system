import type { Metadata } from "next";
import { Suspense } from "react";
import { SuppliersView } from "@/components/suppliers/suppliers-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Suppliers" };

function SuppliersSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-80 w-full" />
    </div>
  );
}

export default function SuppliersPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
        <p className="text-sm text-muted-foreground">
          Who you buy from, and how to reach them. Pick a supplier when you add a product.
        </p>
      </div>
      <Suspense fallback={<SuppliersSkeleton />}>
        <SuppliersView />
      </Suspense>
    </div>
  );
}
