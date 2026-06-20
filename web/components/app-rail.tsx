"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Boxes, Library, Activity, BookText, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Projects", icon: LayoutGrid, match: (p: string) => isProjectsArea(p) },
  { href: "/systems", label: "Systems", icon: Boxes, match: (p: string) => p === "/systems" || p.startsWith("/system/") },
  { href: "/knowledge", label: "Knowledge", icon: Library, match: (p: string) => p.startsWith("/knowledge") },
  { href: "/usage", label: "Usage", icon: Activity, match: (p: string) => p.startsWith("/usage") },
  { href: "/docs", label: "Docs", icon: BookText, match: (p: string) => p.startsWith("/docs") },
  { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

const SECTIONS = ["/systems", "/system/", "/knowledge", "/usage", "/docs", "/settings"];
/** Projects owns "/" and every project page (e.g. "/payments-api") — i.e. not another section. */
function isProjectsArea(p: string): boolean {
  return p === "/" || !SECTIONS.some((s) => p === s.replace(/\/$/, "") || p.startsWith(s));
}

export function AppRail() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Primary"
      className="bp-grid flex w-[var(--rail-w)] shrink-0 flex-col gap-0.5 border-r border-border/70 bg-sidebar p-2"
    >
      <Link href="/" aria-label="Archmantic home" className="mb-3 flex items-center gap-2.5 px-2 py-1.5">
        <span className="relative inline-grid size-5 place-items-center">
          <span className="absolute inset-0 rounded-[3px] border border-primary/50" />
          <span className="absolute inset-0 bp-ticks" />
          <span className="size-1.5 rounded-[1px] bg-primary" />
        </span>
        <span className="bp-title text-sm tracking-tight">archmantic</span>
      </Link>
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 rounded-sm px-2.5 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            {active ? <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" /> : null}
            <Icon className="size-[17px] shrink-0" />
            <span className="bp-label text-[0.62rem]">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
