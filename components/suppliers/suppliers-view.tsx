"use client";

import * as React from "react";
import Link from "next/link";
import { Mail, Phone, Plus, SearchX, Truck } from "lucide-react";
import { PaginationBar } from "@/components/data-table/pagination-bar";
import { RowActions } from "@/components/data-table/row-actions";
import { SearchInput } from "@/components/data-table/search-input";
import { useRemoteList, useSearchBox, useSessionExpired, useUrlState } from "@/components/data-table/use-list-state";
import { Badge } from "@/components/ui/badge";
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
  SUPPLIER_CATEGORIES,
  type Supplier,
  type SupplierCategory,
  type SupplierListResponse,
} from "@/lib/suppliers";
import { DeleteSupplierDialog } from "./delete-supplier-dialog";
import { SupplierFormDialog } from "./supplier-form-dialog";

const ALL = "all";
const DEFAULTS = { q: "", category: ALL, page: "1" };

export function SuppliersView() {
  const [url, updateUrl] = useUrlState(DEFAULTS);
  const category = SUPPLIER_CATEGORIES.includes(url.category as SupplierCategory) ? url.category : ALL;
  const page = Math.max(1, Number(url.page) || 1);
  const sessionExpired = useSessionExpired();

  const apiUrl = `/api/suppliers?${new URLSearchParams({
    q: url.q,
    category: category === ALL ? "" : category,
    page: String(page),
  })}`;
  const { data, loading, error, reload } = useRemoteList<SupplierListResponse>(apiUrl, (res) => {
    if (res.page !== page) updateUrl({ page: res.page });
  });

  const [searchText, setSearchText] = useSearchBox(url.q, (q) => updateUrl({ q, page: 1 }));
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Supplier | null>(null);
  const [deleting, setDeleting] = React.useState<Supplier | null>(null);

  const filtered = url.q !== "" || category !== ALL;
  const clearFilters = () => updateUrl({ q: "", category: ALL, page: 1 });
  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          label="Search suppliers"
          placeholder="Search suppliers…"
          value={searchText}
          onChange={setSearchText}
        />
        <div className="flex gap-3">
          <Select value={category} onValueChange={(v) => updateUrl({ category: v, page: 1 })}>
            <SelectTrigger aria-label="Filter by category" className="h-10 flex-1 bg-card sm:w-48 sm:flex-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value={ALL}>All categories</SelectItem>
              {SUPPLIER_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="lg" className="h-10" onClick={openAdd}>
            <Plus />
            Add supplier
          </Button>
        </div>
      </div>

      <Card className="gap-0 py-0">
        <Table aria-label="Suppliers" aria-busy={loading}>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="pl-3 sm:pl-4">Supplier</TableHead>
              <TableHead className="hidden md:table-cell">Category</TableHead>
              <TableHead className="hidden lg:table-cell">Contact person</TableHead>
              <TableHead className="hidden sm:table-cell">Phone</TableHead>
              <TableHead className="hidden lg:table-cell">Email</TableHead>
              <TableHead className="text-right">Products</TableHead>
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
              : data?.items.map((s) => (
                  <TableRow key={s.id} data-supplier-id={s.id} className={loading ? "opacity-60" : undefined}>
                    <TableCell className="max-w-64 pl-3 whitespace-normal sm:min-w-40 sm:pl-4">
                      <div className="font-medium break-words">{s.name}</div>
                      <div className="text-xs text-muted-foreground md:hidden">{s.category}</div>
                      {s.contactPerson && (
                        <div className="text-xs text-muted-foreground lg:hidden">{s.contactPerson}</div>
                      )}
                      {s.phone && (
                        <a href={`tel:${s.phone}`} className="text-xs text-muted-foreground hover:underline sm:hidden">
                          {s.phone}
                        </a>
                      )}
                      {s.email && (
                        <a
                          href={`mailto:${s.email}`}
                          className="block text-xs break-all text-muted-foreground hover:underline lg:hidden"
                        >
                          {s.email}
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="secondary">{s.category}</Badge>
                    </TableCell>
                    <TableCell className="hidden max-w-40 whitespace-normal lg:table-cell">{s.contactPerson ?? <Dash />}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {s.phone ? (
                        <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1.5 hover:underline">
                          <Phone className="size-3.5 text-muted-foreground" />
                          {s.phone}
                        </a>
                      ) : (
                        <Dash />
                      )}
                    </TableCell>
                    <TableCell className="hidden max-w-56 whitespace-normal lg:table-cell">
                      {s.email ? (
                        <a href={`mailto:${s.email}`} className="inline-flex items-start gap-1.5 break-all hover:underline">
                          <Mail className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          {s.email}
                        </a>
                      ) : (
                        <Dash />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/products?supplier=${s.id}`}
                        aria-label={`${s.productCount} products from ${s.name}`}
                        className="font-medium tabular-nums hover:underline"
                      >
                        {s.productCount}
                      </Link>
                    </TableCell>
                    <TableCell className="pr-2 sm:pr-4">
                      <RowActions
                        name={s.name}
                        onEdit={() => {
                          setEditing(s);
                          setFormOpen(true);
                        }}
                        onDelete={() => setDeleting(s)}
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
                  {url.q ? <>No suppliers match &ldquo;{url.q}&rdquo;</> : "No suppliers in this category"}
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <Truck className="size-10 text-muted-foreground" />
                <div>
                  <p className="font-medium">No suppliers yet</p>
                  <p className="text-sm text-muted-foreground">
                    Save your suppliers&apos; contact details, then pick them when adding products.
                  </p>
                </div>
                <Button onClick={openAdd}>
                  <Plus />
                  Add supplier
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

      <SupplierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        supplier={editing}
        onSaved={(_s, mode) => {
          if (mode === "create" && (filtered || page !== 1)) clearFilters();
          reload();
        }}
        onSessionExpired={sessionExpired}
      />
      <DeleteSupplierDialog
        supplier={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={reload}
        onSessionExpired={sessionExpired}
      />
    </div>
  );
}

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}
