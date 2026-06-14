import type { ReactNode } from "react";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppRail } from "@/components/app-rail";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";

/**
 * Authenticated app shell: persistent icon rail + a slim utility bar + full-bleed
 * content. The shell is exactly viewport-height and only `<main>` scrolls, so the
 * rail and top bar stay fixed while the content scrolls under them.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <AppRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[var(--header-h)] shrink-0 items-center gap-3 border-b border-border/60 px-4">
          <BreadcrumbNav />
          <div className="flex-1" />
          <ThemeToggle />
          <OrganizationSwitcher hidePersonal={false} appearance={{ elements: { rootBox: "flex items-center" } }} />
          <UserButton />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
