import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

/** A clean, modern wordmark glyph — two offset layers (the "model" stacking) in coral. */
export function Mark({ className = "size-6" }: { className?: string }) {
  return (
    <span className={`relative inline-block ${className}`} aria-hidden>
      <span className="absolute left-0 top-0 size-[70%] rounded-[5px] bg-primary/35" />
      <span className="absolute bottom-0 right-0 size-[70%] rounded-[5px] bg-primary" />
    </span>
  );
}

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "https://github.com/mgionas/Archmantic", label: "GitHub", external: true },
];

/** Signed-out / marketing chrome: a clean sticky header over a calm page. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark className="size-5" />
            <span className="text-[0.95rem] font-semibold tracking-tight">Archmantic</span>
          </Link>
          <div className="flex-1" />
          <nav className="flex items-center gap-6">
            {NAV.map((n) =>
              n.external ? (
                <a key={n.label} href={n.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {n.label}
                </a>
              ) : (
                <Link key={n.label} href={n.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  {n.label}
                </Link>
              ),
            )}
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}
