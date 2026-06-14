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
      className="flex w-[var(--rail-w)] shrink-0 flex-col gap-0.5 border-r border-border/60 bg-sidebar p-2"
    >
      <Link href="/" aria-label="Archmantic home" className="mb-2 flex items-center gap-2 px-2 py-1.5 font-bold tracking-tight">
        <span className="size-3 shrink-0 rounded-sm bg-primary" />
        Archmantic
      </Link>
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
