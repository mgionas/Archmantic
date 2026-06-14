import { ROLES, roleColor } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Shared component-role key — the single source of "what do these colors mean". */
export function RoleLegend({ roles, className }: { roles?: string[]; className?: string }) {
  const list = roles ?? ROLES;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {list.map((r) => (
        <span key={r} className="inline-flex items-center gap-1.5 capitalize">
          <span className="size-2 rounded-full" style={{ background: roleColor(r) }} />
          {r}
        </span>
      ))}
    </div>
  );
}
