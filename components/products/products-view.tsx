"use client";

import * as React from "react";
import { PackageOpen, Plus, SearchX, X } from "lucide-react";
import { PaginationBar } from "@/components/data-table/pagination-bar";
import { RowActions } from "@/components/data-table/row-actions";
import { SearchInput } from "@/components/data-table/search-input";
import { useRemoteList, useSearchBox, useSessionExpired, useUrlState } from "@/components/data-table/use-list-state";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PRODUCT_FILTERS,
  formatDate,
  isoDate,
  type Product,
  type ProductFilter,
  type ProductListResponse,
} from "@/lib/products";
import { DeleteProductDialog } from "./delete-product-dialog";
import { LowStockAlert } from "./low-stock-alert";
import { ProductFormDialog } from "./product-form-dialog";
import { ExpiryBadge, StockStatusBadge } from "./status-badges";

const DEFAULTS = { q: "", status: "all", supplier: "", page: "1" };

export function ProductsView() {
  const [url, updateUrl] = useUrlState(DEFAULTS);
  const status: ProductFilter = url.status in PRODUCT_FILTERS ? (url.status as ProductFilter) : "all";
  const page = Math.max(1, Number(url.page) || 1);
  const sessionExpired = useSessionExpired();

  const apiUrl = `/api/products?${new URLSearchParams({ q: url.q, status, supplier: url.supplier, page: String(page) })}`;
  const { data, loading, error, reload } = useRemoteList<ProductListResponse>(apiUrl, (res) => {
    // The server moved us to the last existing page (e.g. after a delete).
    if (res.page !== page) updateUrl({ page: res.page });
  });

  const [searchText, setSearchText] = useSearchBox(url.q, (q) => updateUrl({ q, page: 1 }));
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [deleting, setDeleting] = React.useState<Product | null>(null);

  const filtered = url.q !== "" || status !== "all" || url.supplier !== "";
  const clearFilters = () => updateUrl({ q: "", status: "all", supplier: "", page: 1 });
  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  function onSaved(_product: Product, mode: "create" | "edit") {
    // Show a new product at the top of the unfiltered list.
    if (mode === "create" && (filtered || page !== 1)) clearFilters();
    reload();
  }

  const today = isoDate();

  return (
    <div className="space-y-4">
      {data && (
        <LowStockAlert
          summary={data.summary}
          onViewRestock={() => updateUrl({ status: "low_stock", page: 1 })}
          onViewExpiring={() => updateUrl({ status: "expiring", page: 1 })}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          label="Search products"
          placeholder="Search products…"
          value={searchText}
          onChange={setSearchText}
        />
        <div className="flex gap-3">
          <Select value={status} onValueChange={(v) => updateUrl({ status: v, page: 1 })}>
            <SelectTrigger aria-label="Filter by status" className="h-10 flex-1 bg-card sm:w-48 sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              {Object.entries(PRODUCT_FILTERS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="lg" className="h-10" onClick={openAdd}>
            <Plus />
            Add product
          </Button>
        </div>
      </div>

      {url.supplier && (
        <div className="flex">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pr-1 pl-3 text-sm">
            Supplier: <strong className="font-medium">{data?.supplierFilter?.name ?? "…"}</strong>
            <button
              type="button"
              aria-label="Remove supplier filter"
              onClick={() => updateUrl({ supplier: "", page: 1 })}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </span>
        </div>
      )}

      <Card className="gap-0 py-0">
        <Table aria-label="Products" aria-busy={loading}>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-3 sm:pl-4">Product</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Expiration</TableHead>
              <TableHead className="hidden lg:table-cell">Supplier</TableHead>
              <TableHead className="pr-2 text-right sm:pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && !data
              ? Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="px-4">
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              : data?.items.map((p) => (
                  <TableRow key={p.id} data-product-id={p.id} className={loading ? "opacity-60" : undefined}>
                    <TableCell className="max-w-56 pl-3 whitespace-normal sm:pl-4">
                      <div className="font-medium break-words">{p.name}</div>
                      <div className="text-xs text-muted-foreground md:hidden">{p.productType}</div>
                      {p.supplierName && (
                        <div className="text-xs text-muted-foreground lg:hidden">{p.supplierName}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{p.productType}</TableCell>
                    <TableCell className="text-right">
                      <div className="font-medium tabular-nums">{p.quantity.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">min {p.reorderLevel.toLocaleString()}</div>
                    </TableCell>
                    <TableCell>
                      <StockStatusBadge status={p.stockStatus} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {p.expirationDate ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-sm">{formatDate(p.expirationDate)}</span>
                          <ExpiryBadge date={p.expirationDate} today={today} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {p.supplierName ?? "—"}
                    </TableCell>
                    <TableCell className="pr-2 sm:pr-4">
                      <RowActions
                        name={p.name}
                        onEdit={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                        onDelete={() => setDeleting(p)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>

        {data && data.items.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-4 py-14 text-center">
            {filtered ? (
              <>
                <SearchX className="size-10 text-muted-foreground" />
                <p className="font-medium">
                  {url.q ? <>No products match &ldquo;{url.q}&rdquo;</> : "No products match this filter"}
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <PackageOpen className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">No products yet</p>
                  <p className="text-sm text-muted-foreground">Add your first product to start tracking stock.</p>
                </div>
                <Button onClick={openAdd}>
                  <Plus />
                  Add product
                </Button>
              </>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-10 text-center text-sm">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" onClick={reload}>
              Try again
            </Button>
          </div>
        )}

        {data && (
          <PaginationBar
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={(p) => updateUrl({ page: p })}
          />
        )}
      </Card>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        onSaved={onSaved}
        onSessionExpired={sessionExpired}
      />
      <DeleteProductDialog
        product={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={reload}
        onSessionExpired={sessionExpired}
      />
    </div>
  );
}
