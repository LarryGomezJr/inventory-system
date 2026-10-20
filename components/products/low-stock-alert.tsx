"use client";

import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ProductSummary } from "@/lib/products";

export function LowStockAlert({
  summary,
  onViewRestock,
  onViewExpiring,
}: {
  summary: ProductSummary;
  onViewRestock: () => void;
  onViewExpiring: () => void;
}) {
  const restock = summary.lowStock + summary.outOfStock;
  const expiry = summary.expired + summary.expiringSoon;
  if (restock === 0 && expiry === 0) return null;

  return (
    <Alert
      role="alert"
      aria-label="Stock alerts"
      className="border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 *:[svg]:text-amber-600"
    >
      <AlertTriangle />
      <AlertTitle className="font-semibold">
        {restock > 0
          ? `${restock} product${restock === 1 ? " needs" : "s need"} restocking`
          : "Some products are expiring"}
      </AlertTitle>
      <AlertDescription className="mt-1 space-y-3 text-amber-900/90">
        {restock > 0 && (
          <p>
            {summary.outOfStock > 0 && (
              <strong className="font-semibold text-red-700">{summary.outOfStock} out of stock</strong>
            )}
            {summary.outOfStock > 0 && summary.lowStock > 0 && " · "}
            {summary.lowStock > 0 && <span>{summary.lowStock} running low</span>}
          </p>
        )}
        {summary.alerts.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Products that need restocking">
            {summary.alerts.map((a) => (
              <li
                key={a.id}
                className="rounded-full border border-amber-300 bg-white/70 px-2.5 py-0.5 text-xs font-medium text-amber-950"
              >
                {a.name} — {a.quantity === 0 ? "out of stock" : `${a.quantity} left`}
              </li>
            ))}
          </ul>
        )}
        {expiry > 0 && (
          <p>
            {summary.expired > 0 && `${summary.expired} expired`}
            {summary.expired > 0 && summary.expiringSoon > 0 && " · "}
            {summary.expiringSoon > 0 && `${summary.expiringSoon} expiring within 30 days`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {restock > 0 && (
            <Button size="sm" onClick={onViewRestock} className="bg-amber-600 text-white hover:bg-amber-700">
              View low stock
            </Button>
          )}
          {expiry > 0 && (
            <Button size="sm" variant="outline" onClick={onViewExpiring} className="border-amber-300 bg-white/70">
              View expiring
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
