import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-20">
      <div className="text-6xl font-bold tracking-tight text-primary">404</div>
      <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link href="/" className={buttonVariants()}>
        Back home
      </Link>
    </div>
  );
}
