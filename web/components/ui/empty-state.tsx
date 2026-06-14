import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Consistent empty/no-data state: a sentence + optional guidance/CTA. */
export function EmptyState({
  title,
  icon,
  className,
  children,
}: {
  title: string;
  icon?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/60 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <div className="font-medium">{title}</div>
      {children ? <div className="max-w-sm text-sm text-muted-foreground">{children}</div> : null}
    </div>
  );
}
