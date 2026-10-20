import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className, inverted }: { className?: string; inverted?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg",
          inverted ? "bg-[#faf7f0] text-[#0b1f3a]" : "bg-primary text-primary-foreground",
        )}
      >
        <Boxes className="size-5" />
      </span>
      <span className="text-lg font-semibold tracking-tight">Inventory System</span>
    </div>
  );
}
