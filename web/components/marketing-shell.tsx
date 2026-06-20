import type { ReactNode } from "react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

/** A small drafting glyph: a cyan registration mark inside a ticked frame — the
 *  Archmantic "sheet" logo. */
function Mark() {
  return (
    <span className="relative inline-grid size-5 place-items-center">
      <span className="absolute inset-0 rounded-[3px] border border-primary/50" />
      <span className="absolute inset-0 bp-ticks" />
      <span className="size-1.5 rounded-[1px] bg-primary" />
    </span>
  );
}

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "https://github.com/mgionas/Archmantic", label: "GitHub", external: true },
];

/** Signed-out / marketing chrome: a drafting-sheet header over a faint blueprint field. */
export function MarketingShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen bp-grid">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-6">
          <Link href="/" className="group flex items-center gap-2.5">
            <Mark />
            <span className="bp-title text-[0.95rem] tracking-tight">archmantic</span>
          </Link>
          <span className="hidden bp-label text-[0.6rem] text-muted-foreground sm:inline">living architecture</span>
          <div className="flex-1" />
          <nav className="flex items-center gap-5">
            {NAV.map((n) =>
              n.external ? (
                <a
                  key={n.label}
                  href={n.href}
                  className="bp-label text-[0.62rem] text-muted-foreground transition-colors hover:text-primary"
                >
                  {n.label}
                </a>
              ) : (
                <Link
                  key={n.label}
                  href={n.href}
                  className="bp-label text-[0.62rem] text-muted-foreground transition-colors hover:text-primary"
                >
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
