"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";

const SECTION: Record<string, string> = {
  systems: "Systems",
  system: "Systems",
  knowledge: "Knowledge",
  usage: "Usage",
  docs: "Docs",
  settings: "Settings",
};
const FACET: Record<string, string> = {
  overview: "Overview",
  diagrams: "Diagrams",
  features: "Features",
  capabilities: "Capabilities",
  components: "Components",
  data: "Data",
  api: "API",
  changes: "Changes",
  knowledge: "Knowledge",
};

/** Location breadcrumb: Projects / <section|project> / <facet>. */
export function BreadcrumbNav() {
  const pathname = usePathname() ?? "/";
  const view = useSearchParams().get("view") ?? "";
  const parts = pathname.split("/").filter(Boolean).map(decodeURIComponent);

  const crumbs: { label: string; href?: string }[] = [{ label: "Projects", href: "/" }];
  if (parts.length === 0) {
    crumbs[0] = { label: "Projects" }; // home → current
  } else if (SECTION[parts[0]!]) {
    crumbs.push({ label: SECTION[parts[0]!]!, href: `/${parts[0]}` });
    if (parts[0] === "system" && parts[1]) crumbs.push({ label: parts[1]! });
  } else {
    // a project page
    crumbs.push({ label: parts[0]!, href: `/${encodeURIComponent(parts[0]!)}` });
    if (view && FACET[view]) crumbs.push({ label: FACET[view]! });
  }
  // the last crumb is the current location (no link)
  const last = crumbs.length - 1;

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {crumbs.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1">
          {i > 0 ? <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/60" /> : null}
          {c.href && i !== last ? (
            <Link href={c.href} className="truncate text-muted-foreground hover:text-foreground">
              {c.label}
            </Link>
          ) : (
            <span className={i === last ? "truncate font-medium" : "truncate text-muted-foreground"}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
