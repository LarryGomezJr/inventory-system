import { AlertTriangle, CheckCircle2, CircleSlash, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STOCK_STATUS_LABELS, expiryStatus, type StockStatus } from "@/lib/products";

const stockStyles: Record<StockStatus, string> = {
  in_stock: "bg-emerald-50 text-emerald-800 border-emerald-200",
  low_stock: "bg-amber-50 text-amber-800 border-amber-200",
  out_of_stock: "bg-red-50 text-red-700 border-red-200",
};

const stockIcons = {
  in_stock: CheckCircle2,
  low_stock: AlertTriangle,
  out_of_stock: CircleSlash,
} as const;

export function StockStatusBadge({ status }: { status: StockStatus }) {
  const Icon = stockIcons[status];
  return (
    <Badge variant="outline" className={cn("gap-1", stockStyles[status])} data-status={status}>
      <Icon data-icon="inline-start" />
      {STOCK_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ExpiryBadge({ date, today }: { date: string | null; today?: string }) {
  const status = expiryStatus(date, today);
  if (status.kind === "expired") {
    return (
      <Badge variant="outline" className="gap-1 border-red-200 bg-red-50 text-red-700">
        <Clock data-icon="inline-start" />
        Expired
      </Badge>
    );
  }
  if (status.kind === "expiring") {
    const label = status.days === 0 ? "Expires today" : `${status.days}d left`;
    return (
      <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 text-amber-800">
        <Clock data-icon="inline-start" />
        {label}
      </Badge>
    );
  }
  return null;
}
