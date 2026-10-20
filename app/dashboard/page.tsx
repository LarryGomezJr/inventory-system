import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, ArrowRight, CircleSlash, Clock, Package, PackageOpen, type LucideIcon } from "lucide-react";
import { ExpiryBadge, StockStatusBadge } from "@/components/products/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { getInventoryOverview } from "@/lib/inventory";
import { formatDate, isoDate } from "@/lib/products";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

async function Greeting() {
  const user = await getCurrentUser();
  const firstName = user.fullName.split(" ")[0];
  return <>Welcome back, {firstName}</>;
}

type Stat = { label: string; value: number; note: string; icon: LucideIcon; tone?: "warn" | "danger"; href: string };

async function StatCards() {
  const { summary } = await getInventoryOverview();
  const stats: Stat[] = [
    { label: "Total products", value: summary.total, note: "In your inventory", icon: Package, href: "/dashboard/products" },
    {
      label: "Low stock",
      value: summary.lowStock,
      note: summary.lowStock ? "At or below reorder level" : "Nothing running low",
      icon: AlertTriangle,
      tone: summary.lowStock ? "warn" : undefined,
      href: "/dashboard/products?status=low_stock",
    },
    {
      label: "Out of stock",
      value: summary.outOfStock,
      note: summary.outOfStock ? "Restock needed" : "All items available",
      icon: CircleSlash,
      tone: summary.outOfStock ? "danger" : undefined,
      href: "/dashboard/products?status=out_of_stock",
    },
    {
      label: "Expiring in 30 days",
      value: summary.expiringSoon,
      note: summary.expired ? `${summary.expired} already expired` : "Check dates regularly",
      icon: Clock,
      tone: summary.expired ? "danger" : summary.expiringSoon ? "warn" : undefined,
      href: "/dashboard/products?status=expiring",
    },
  ];

  return (
    <>
      {stats.map(({ label, value, note, icon: Icon, tone, href }) => (
        <Link key={label} href={href} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-3xl font-semibold tracking-tight tabular-nums" data-stat={label}>
                  {value.toLocaleString()}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    tone === "danger" ? "font-medium text-destructive" : tone === "warn" ? "font-medium text-amber-700" : "text-muted-foreground",
                  )}
                >
                  {note}
                </p>
              </div>
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg",
                  tone === "danger"
                    ? "bg-destructive/10 text-destructive"
                    : tone === "warn"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-primary text-primary-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>
            </CardContent>
          </Card>
        </Link>
      ))}
    </>
  );
}

async function RecentProducts() {
  const { recent } = await getInventoryOverview();
  const today = isoDate();

  if (recent.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <PackageOpen className="size-10 text-muted-foreground" />
        <p className="font-medium">No products yet</p>
        <Button asChild>
          <Link href="/dashboard/products">Add your first product</Link>
        </Button>
      </div>
    );
  }

  return (
    <Table aria-label="Recently added products">
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead className="hidden sm:table-cell">Type</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Expiration</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {recent.map((p) => (
          <TableRow key={p.id}>
            <TableCell className="max-w-48 font-medium whitespace-normal break-words">{p.name}</TableCell>
            <TableCell className="hidden text-muted-foreground sm:table-cell">{p.productType}</TableCell>
            <TableCell className="text-right tabular-nums">{p.quantity.toLocaleString()}</TableCell>
            <TableCell>
              <StockStatusBadge status={p.stockStatus} />
            </TableCell>
            <TableCell className="hidden md:table-cell">
              {p.expirationDate ? (
                <span className="flex flex-wrap items-center gap-1.5">
                  {formatDate(p.expirationDate)}
                  <ExpiryBadge date={p.expirationDate} today={today} />
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

async function LowStockList() {
  const { summary } = await getInventoryOverview();

  if (summary.alerts.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">All products are above their reorder level.</p>;
  }

  return (
    <ul className="space-y-4" aria-label="Low stock products">
      {summary.alerts.map((item) => {
        const pct = item.reorderLevel > 0 ? Math.min(100, Math.round((item.quantity / item.reorderLevel) * 100)) : 0;
        return (
          <li key={item.id} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{item.name}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {item.quantity} / {item.reorderLevel}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full", item.quantity === 0 ? "bg-destructive" : "bg-amber-500")}
                style={{ width: `${Math.max(pct, item.quantity === 0 ? 0 : 4)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function StatSkeletons() {
  return (
    <>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-[106px] rounded-xl" />
      ))}
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          <Suspense fallback="Welcome back">
            <Greeting />
          </Suspense>
        </h1>
        <p className="text-sm text-muted-foreground">Here&apos;s an overview of your inventory.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Suspense fallback={<StatSkeletons />}>
          <StatCards />
        </Suspense>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>Recently added</CardTitle>
              <CardDescription>The latest products in your inventory</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/products">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <RecentProducts />
            </Suspense>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Low stock alerts</CardTitle>
            <CardDescription>Products at or below their reorder level</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <LowStockList />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
