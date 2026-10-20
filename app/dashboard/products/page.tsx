import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductsView } from "@/components/products/products-view";

export const metadata: Metadata = { title: "Products" };

function ProductsSkeleton() {
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

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">
          Everything in your inventory. Add, update and restock products here.
        </p>
      </div>
      <Suspense fallback={<ProductsSkeleton />}>
        <ProductsView />
      </Suspense>
    </div>
  );
}
