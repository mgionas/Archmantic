import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { latestModelsForOwner } from "@/lib/store";
import { buildSystemView } from "@/lib/system";
import { Mermaid } from "../../diagrams-client";

export const dynamic = "force-dynamic";

export default async function SystemPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: raw } = await params;
  const name = decodeURIComponent(raw);
  const { userId, orgId } = await auth();
  const owner = orgId ?? userId;
  const all = owner ? await latestModelsForOwner(owner) : [];
  const models = all.filter((m) => m.system === name);

  if (models.length === 0) {
    return (
      <div className="space-y-4">
        <a href="/systems" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ← systems
        </a>
        <h1 className="text-2xl font-bold">{name}</h1>
        <Card className="p-6 text-sm text-muted-foreground">No services in this system yet.</Card>
      </div>
    );
  }

  const view = buildSystemView(models, name);

  return (
    <div>
      <a href="/systems" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        ← systems
      </a>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">{name}</h1>
      <p className="text-sm text-muted-foreground">
        {view.totals.services} services · {view.totals.components} components · {view.totals.capabilities} capabilities
      </p>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Cross-service context</h2>
      <div className="h-[60vh]">
        <Mermaid id="sys" chart={view.mermaid} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Services</h2>
      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Service</TableHead>
              <TableHead>Components</TableHead>
              <TableHead>Capabilities</TableHead>
              <TableHead>Consumes</TableHead>
              <TableHead>Stack</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.services.map((s) => (
              <TableRow key={s.project}>
                <TableCell className="font-medium">
                  <Link href={`/${encodeURIComponent(s.project)}`} className="hover:underline">
                    {s.project}
                  </Link>
                </TableCell>
                <TableCell>{s.components}</TableCell>
                <TableCell>{s.capabilities}</TableCell>
                <TableCell className="text-muted-foreground">{s.consumes.join(", ") || "—"}</TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {s.technologies.length ? (
                    s.technologies.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs">
                        {t}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
