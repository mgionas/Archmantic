import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { usageSummary } from "@/lib/admin";

export const dynamic = "force-dynamic";

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <Card className="p-5">
      <div className={`text-3xl font-bold tracking-tight ${accent ? "text-primary" : ""}`}>{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </Card>
  );
}

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

export default async function Usage() {
  const { userId, orgId } = await auth();
  const owner = orgId ?? userId;
  const s = owner
    ? await usageSummary(owner)
    : { calls: 0, pushes: 0, tokensOut: 0, tokensSaved: 0, savedPct: 0, byTool: [], byProject: [], daily: [] };

  const maxTool = Math.max(1, ...s.byTool.map((t) => t.calls));
  const maxDay = Math.max(1, ...s.daily.map((d) => d.calls));

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agent usage</h1>
          <p className="text-sm text-muted-foreground">
            Proof your agents read the model over MCP — and the tokens that saved vs reading source files.
          </p>
        </div>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          All projects
        </Link>
      </div>

      {s.calls === 0 && s.pushes === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          No MCP usage recorded yet. Point an agent at the server (<code className="rounded bg-muted px-1.5 py-0.5">archmantic mcp</code>)
          with your token set, and tool calls show up here. You can also push a local log with{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">archmantic usage --sync</code>.
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={compact(s.calls)} label="MCP tool calls" />
            <Stat value={`~${compact(s.tokensSaved)}`} label="tokens saved" accent />
            <Stat value={`${s.savedPct}%`} label="fewer tokens vs reading files" accent />
            <Stat value={compact(s.pushes)} label="model pushes" />
          </div>

          {s.daily.length > 0 ? (
            <div>
              <h2 className="mb-3 text-lg font-semibold">Activity (last 14 days)</h2>
              <Card className="flex items-end gap-1.5 p-5" style={{ height: 140 }}>
                {s.daily.map((d) => (
                  <div key={d.day} className="group flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.calls} calls`}>
                    <div
                      className="w-full rounded-t bg-primary/70 transition-colors group-hover:bg-primary"
                      style={{ height: `${Math.max(4, (d.calls / maxDay) * 100)}%` }}
                    />
                    <span className="text-[10px] text-muted-foreground">{d.day.slice(5)}</span>
                  </div>
                ))}
              </Card>
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-lg font-semibold">By tool</h2>
              <Card className="space-y-2.5 p-5">
                {s.byTool.map((t) => (
                  <div key={t.tool} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-mono">{t.tool}</span>
                      <span className="text-muted-foreground">
                        {t.calls} calls · ~{compact(t.saved)} saved
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${(t.calls / maxTool) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </Card>
            </div>

            <div>
              <h2 className="mb-3 text-lg font-semibold">By project</h2>
              <Card className="p-5">
                {s.byProject.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No per-project data.</p>
                ) : (
                  <ul className="space-y-2">
                    {s.byProject.map((p) => (
                      <li key={p.project} className="flex items-baseline justify-between gap-2 text-sm">
                        <Link href={`/${encodeURIComponent(p.project)}`} className="font-medium hover:underline">
                          {p.project}
                        </Link>
                        <Badge variant="secondary">
                          {p.calls} calls · ~{compact(p.saved)} saved
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Token savings are estimated (≈ chars/4) vs the source an agent would otherwise read to answer the same query.
          </p>
        </div>
      )}
    </div>
  );
}
