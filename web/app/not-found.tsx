import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-3 py-20">
      <div className="bg-gradient-to-r from-indigo-400 to-fuchsia-400 bg-clip-text text-6xl font-bold text-transparent">
        404
      </div>
      <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link href="/" className={buttonVariants()}>
        Back home
      </Link>
    </div>
  );
}
