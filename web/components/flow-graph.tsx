"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { X } from "lucide-react";
import "@xyflow/react/dist/style.css";

/** fitView animation duration, honoring prefers-reduced-motion (0 = no pan animation). */
export function focusDuration(ms = 400): number {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

/** Shared edge-label styling: a background plate so labels read over busy edges. */
export const EDGE_LABEL = {
  labelBgPadding: [4, 2] as [number, number],
  labelBgBorderRadius: 3,
  labelBgStyle: { fill: "var(--background)", fillOpacity: 0.85 },
  labelStyle: { fontSize: 11, fill: "var(--muted-foreground)" },
};

/** Fullscreen toggle for a canvas wrapper: put `ref` on the element, call `toggle`. */
export function useFullscreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void el.requestFullscreen?.();
  };
  return { ref, toggle };
}

/** Common ReactFlow props: theme color mode + Google-Maps gestures. */
export function useFlowProps() {
  const { resolvedTheme } = useTheme();
  return {
    fitView: true,
    minZoom: 0.05,
    maxZoom: 4,
    colorMode: (resolvedTheme === "light" ? "light" : "dark") as "light" | "dark",
    panOnScroll: true,
    zoomOnScroll: false,
    zoomOnPinch: true,
    panOnDrag: true,
    nodesConnectable: false,
  };
}

/** Right-side detail drawer shared by the interactive graphs. */
export function GraphDrawer({
  title,
  subtitle,
  accent,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-label={`${title} details`}
      className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col gap-4 overflow-auto border-l border-border/60 bg-card/95 p-4 backdrop-blur"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {accent ? <span className="size-2.5 shrink-0 rounded-full" style={{ background: accent }} /> : null}
            <span className="truncate font-semibold">{title}</span>
          </div>
          {subtitle ? <div className="mt-0.5 font-mono text-xs text-muted-foreground">{subtitle}</div> : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="shrink-0 rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

export function DrawerSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
