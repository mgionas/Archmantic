import type { ReactNode } from "react";
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/components/theme-toggle";
import { AppRail } from "@/components/app-rail";

/** Authenticated app shell: persistent icon rail + a slim utility bar + full-bleed content. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[var(--header-h)] shrink-0 items-center gap-3 border-b border-border/60 px-4">
          <div className="flex-1" />
          <ThemeToggle />
          <OrganizationSwitcher hidePersonal={false} appearance={{ elements: { rootBox: "flex items-center" } }} />
          <UserButton />
        </header>
        <main className="min-w-0 flex-1 px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
