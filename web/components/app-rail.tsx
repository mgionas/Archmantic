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
      className="flex w-[var(--rail-w)] shrink-0 flex-col items-center gap-1 border-r border-border/60 bg-sidebar py-3"
    >
      <Link href="/" aria-label="Archmantic home" className="mb-2 grid size-9 place-items-center">
        <span className="size-3 rounded-sm bg-primary" />
      </Link>
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              active && "bg-primary/10 text-primary",
            )}
          >
            {active && <span className="absolute left-[-12px] h-5 w-0.5 rounded-full bg-primary" />}
            <Icon className="size-[18px]" />
          </Link>
        );
      })}
    </nav>
  );
}
