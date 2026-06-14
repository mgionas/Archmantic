import { Skeleton } from "@/components/ui/skeleton";

/** Generic loading placeholder for the dynamic, server-rendered pages. */
export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-[50vh] w-full" />
    </div>
  );
}
