import {
  ArrowLeftRight,
  BarChart3,
  LayoutDashboard,
  Package,
  Tags,
  Truck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; soon?: boolean };

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Products", href: "/dashboard/products", icon: Package },
  { label: "Categories", href: "/dashboard/categories", icon: Tags, soon: true },
  { label: "Suppliers", href: "/dashboard/suppliers", icon: Truck },
  { label: "Stock movements", href: "/dashboard/stock", icon: ArrowLeftRight, soon: true },
  { label: "Reports", href: "/dashboard/reports", icon: BarChart3, soon: true },
];
