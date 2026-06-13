import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Boxes } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { latestModelsForOwner } from "@/lib/store";
import { listSystems, analyzeLinks, type RepoLink } from "@/lib/system";

export const dynamic = "force-dynamic";

const LINK_STYLE: Record<string, { dot: string; label: string }> = {
  connected: { dot: "bg-green-400", label: "connected" },
  inferred: { dot: "bg-amber-400", label: "inferred — confirm?" },
  dangling: { dot: "bg-red-400", label: "dangling — gap" },
};

function LinkRow({ link }: { link: RepoLink }) {
  const s = LINK_STYLE[link.status]!;
  return (
    <li className="flex items-start gap-3 py-2">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${s.dot}`} />
      <div className="min-w-0">
        <div className="text-sm">
          <span className="font-medium">{link.from}</span> <span className="text-muted-foreground">→</span>{" "}
          <span className="font-medium">{link.to}</span>
        </div>
        <div className="text-xs text-muted-foreground">{link.reason}</div>
      </div>
    </li>
  );
}

export default async function Systems() {
  const { userId, orgId } = await auth();
  const owner = orgId ?? userId;
  const models = owner ? await latestModelsForOwner(owner) : [];
  const systems = listSystems(models);
  const ungrouped = models.filter((m) => !m.system).length;
  const linkAnalysis = analyzeLinks(models);
  const suggestions = linkAnalysis.links.filter((l) => l.status !== "connected");

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

      {linkAnalysis.links.length > 0 ? (
        <div className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-lg font-semibold">Cross-repo links</h2>
            <span className="text-xs text-muted-foreground">
              {linkAnalysis.counts.connected} connected · {linkAnalysis.counts.inferred} inferred ·{" "}
              {linkAnalysis.counts.dangling} dangling
            </span>
          </div>
          {suggestions.length === 0 ? (
            <Card className="p-5 text-sm text-muted-foreground">
              All declared links resolve to repos in this org — nothing to confirm or fix. ✅
            </Card>
          ) : (
            <Card className="p-5">
              <p className="mb-2 text-sm text-muted-foreground">
                Detected couplings not yet declared (<span className="text-amber-400">inferred</span>) and declared
                dependencies with no matching repo (<span className="text-red-400">dangling</span>). Confirm an inferred
                link by adding it to that repo&apos;s{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">.archmantic/config.json</code>{" "}
                <code className="rounded bg-muted px-1.5 py-0.5">consumes</code>.
              </p>
              <ul className="divide-y divide-border/40">
                {suggestions.map((l, i) => (
                  <LinkRow key={`${l.from}-${l.to}-${l.status}-${i}`} link={l} />
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : null}
    </div>
  );
}
