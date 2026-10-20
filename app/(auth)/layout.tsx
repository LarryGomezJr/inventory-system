import { BarChart3, PackageCheck, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const highlights = [
  { icon: PackageCheck, text: "Track every product and stock level in one place" },
  { icon: BarChart3, text: "Spot low stock before it becomes a problem" },
  { icon: ShieldCheck, text: "Two-step sign-in keeps your data protected" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-[#0b1f3a] p-10 text-[#faf7f0] lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-[#14305a] opacity-60"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 size-80 rounded-full bg-[#1e3a5f] opacity-40"
        />
        <Logo inverted className="relative" />
        <div className="relative max-w-md space-y-8">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight">
            Know what you have, where it is, and when to reorder.
          </h1>
          <ul className="space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[#e9e1cf]">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="size-4.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-[#b9c3d3]">
          Inventory System · Stock management made simple
        </p>
      </aside>

      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <Logo className="mb-8 lg:hidden" />
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
