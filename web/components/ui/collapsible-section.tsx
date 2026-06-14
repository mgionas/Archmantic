"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A titled section that collapses and remembers its open/closed state in
 * localStorage (keyed by `storageKey`). Defaults open; reads the persisted value
 * on mount (client-only, so no SSR hydration mismatch).
 */
export function CollapsibleSection({
  storageKey,
  header,
  count,
  accent,
  defaultOpen = true,
  children,
}: {
  storageKey: string;
  header: ReactNode;
  count?: number;
  accent?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v !== null) setOpen(v === "1");
    } catch {
      /* private mode / no storage */
    }
  }, [storageKey]);

  const toggle = () =>
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="mb-2 flex w-full items-center gap-2 rounded-md py-0.5 text-left hover:text-foreground"
      >
        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        {accent ? <span className="size-2 shrink-0 rounded-full" style={{ background: accent }} /> : null}
        <span className="text-sm font-medium">{header}</span>
        {count != null ? <span className="text-xs text-muted-foreground">{count}</span> : null}
      </button>
      {open ? children : null}
    </div>
  );
}
