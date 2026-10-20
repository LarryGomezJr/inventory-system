"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { navItems } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <Logo inverted />
      </div>
      <nav className="flex-1 space-y-1 p-3" aria-label="Main">
        {navItems.map(({ label, href, icon: Icon, soon }) => {
          const active = pathname === href;
          const content = (
            <>
              <Icon className="size-4.5" />
              <span className="flex-1">{label}</span>
              {soon && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sidebar-foreground/70">
                  Soon
                </span>
              )}
            </>
          );
          const base = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors";
          return soon ? (
            <div key={href} aria-disabled className={cn(base, "cursor-not-allowed text-sidebar-foreground/50")}>
              {content}
            </div>
          ) : (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                base,
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              {content}
            </Link>
          );
        })}
      </nav>
      <div className="m-3 rounded-lg bg-sidebar-accent/60 p-4 text-xs text-sidebar-foreground/80">
        Categories, stock movements and reports are coming next.
      </div>
    </aside>
  );
}
