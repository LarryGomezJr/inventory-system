"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { navItems } from "./nav-items";

export function MobileNav() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {navItems.map(({ label, href, icon: Icon, soon }) =>
          soon ? (
            <DropdownMenuItem key={href} disabled>
              <Icon /> {label}
              <span className="ml-auto text-[10px] uppercase">Soon</span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={href} asChild>
              <Link href={href}>
                <Icon /> {label}
              </Link>
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
