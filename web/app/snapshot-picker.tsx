"use client";

import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import type { Snapshot } from "@/lib/store";

export function SnapshotPicker({ snapshots, current }: { snapshots: Snapshot[]; current: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={buttonVariants({ variant: "outline", size: "sm" }) + " gap-1.5"}>
        <span className="font-mono">{current.slice(0, 7)}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-auto">
        {snapshots.map((s, i) => (
          <DropdownMenuItem
            key={s.commit_sha}
            onClick={() => router.push(`${pathname}?commit=${encodeURIComponent(s.commit_sha)}`)}
          >
            <span className="font-mono">{s.commit_sha.slice(0, 7)}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {new Date(s.pushed_at).toLocaleDateString()}
              {i === 0 ? " · latest" : ""}
            </span>
            {s.commit_sha === current ? <Check className="ml-auto size-3.5 text-primary" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
