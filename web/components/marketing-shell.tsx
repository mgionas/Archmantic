import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

/** Signed-out / marketing chrome: centered column with a slim top header. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-6">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span className="inline-block size-2.5 rounded-sm bg-primary" />
            Archmantic
          </Link>
          <div className="flex-1" />
          <Link href="/docs" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Docs
          </Link>
          <a
            href="https://github.com/mgionas/Archmantic"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </>
  );
}
