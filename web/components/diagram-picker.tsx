"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PickerItem {
  id: string;
  name: string;
}

/**
 * Searchable selector for a deck of diagrams (sequences/processes). Replaces the
 * wall-of-buttons that breaks at 70+ features: a trigger showing the active item +
 * count, opening a typeahead list with ↑/↓/Enter/Esc. Dependency-light (no cmdk).
 */
export function DiagramPicker({
  items,
  active,
  onPick,
  label = "feature",
}: {
  items: PickerItem[];
  active: string;
  onPick: (id: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const activeItem = items.find((i) => i.id === active) ?? items[0];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  }, [items, query]);

  // Close on outside click / Escape; focus the filter when opening.
  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, filtered.findIndex((i) => i.id === active)));
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const choose = (id: string) => {
    onPick(id);
    setOpen(false);
    setQuery("");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = filtered[hi];
      if (it) choose(it.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative mt-3 w-full max-w-sm text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-1.5 hover:border-border focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="truncate">{activeItem?.name ?? "Select…"}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          {items.length}
          <ChevronsUpDown className="size-3.5" />
        </span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-border/60 bg-popover shadow-xl">
          <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHi(0);
              }}
              onKeyDown={onKey}
              placeholder={`Search ${items.length} ${label}s…`}
              aria-controls={listId}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul id={listId} role="listbox" className="max-h-72 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">No matches.</li>
            ) : (
              filtered.map((it, i) => (
                <li key={it.id} role="option" aria-selected={it.id === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setHi(i)}
                    onClick={() => choose(it.id)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left",
                      i === hi ? "bg-muted text-foreground" : "text-muted-foreground",
                      it.id === active && "font-medium text-foreground",
                    )}
                  >
                    <span className="truncate">{it.name}</span>
                    {it.id === active ? <span className="text-xs text-primary">current</span> : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
