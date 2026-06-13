import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80" />
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-9 w-72 rounded-lg" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  );
}
