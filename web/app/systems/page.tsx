import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Boxes } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { latestModelsForOwner } from "@/lib/store";
import { listSystems } from "@/lib/system";

export const dynamic = "force-dynamic";

export default async function Systems() {
  const { userId, orgId } = await auth();
  const owner = orgId ?? userId;
  const models = owner ? await latestModelsForOwner(owner) : [];
  const systems = listSystems(models);
  const ungrouped = models.filter((m) => !m.system).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Systems</h1>
          <p className="text-sm text-muted-foreground">
            Multi-repo views — microservices and split front/back, unified across repos.
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          All projects
        </Link>
      </div>

      {systems.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No systems yet. Add <code className="rounded bg-muted px-1.5 py-0.5">.archmantic/config.json</code> with{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">{`{ "system": "...", "consumes": ["..."] }`}</code> in each
          repo, then <code className="rounded bg-muted px-1.5 py-0.5">archmantic push</code>.
          {ungrouped > 0 ? ` (${ungrouped} project${ungrouped === 1 ? "" : "s"} not assigned to a system.)` : ""}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {systems.map((s) => (
            <Link key={s.name} href={`/system/${encodeURIComponent(s.name)}`} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-primary/50">
                <div className="mb-2 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Boxes className="size-4.5" />
                </div>
                <div className="text-base font-semibold">{s.name}</div>
                <Badge variant="secondary" className="mt-2">
                  {s.services} service{s.services === 1 ? "" : "s"}
                </Badge>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
