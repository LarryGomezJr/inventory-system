import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { SessionTimeout } from "@/components/dashboard/session-timeout";
import { Sidebar } from "@/components/dashboard/sidebar";
import { UserMenu } from "@/components/dashboard/user-menu";
import { getCurrentUser } from "@/lib/auth";
import { IDLE_TIMEOUT_SECONDS } from "@/lib/session-activity";

async function CurrentUserMenu() {
  const { fullName, username, email } = await getCurrentUser();
  return <UserMenu user={{ fullName, username, email }} />;
}

function UserMenuSkeleton() {
  return (
    <div className="flex items-center gap-3 p-1.5">
      <div className="size-8 animate-pulse rounded-full bg-muted" />
      <div className="hidden h-8 w-28 animate-pulse rounded bg-muted sm:block" />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <MobileNav />
            <Logo className="lg:hidden [&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
          </div>
          <Suspense fallback={<UserMenuSkeleton />}>
            <CurrentUserMenu />
          </Suspense>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
      <SessionTimeout idleSeconds={IDLE_TIMEOUT_SECONDS} />
    </div>
  );
}
