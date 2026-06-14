import { cn } from "@/lib/utils";

/** A grounded `file:line` reference — links to source when a repo URL is known. */
export function Provenance({ refText, href, className }: { refText?: string | null; href?: string | null; className?: string }) {
  if (!refText) return null;
  const cls = cn("font-mono text-xs text-muted-foreground", className);
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className={cn(cls, "hover:text-primary hover:underline")} title="Open source">
      {refText}
    </a>
  ) : (
    <span className={cls} title="grounded reference">
      {refText}
    </span>
  );
}
