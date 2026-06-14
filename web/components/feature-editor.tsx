"use client";

import { useState } from "react";
import { Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FeatureView } from "@/app/project-tabs";

const ta = "w-full rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-sm";

/** A feature card with inline editing. Saves to the cloud (hosted edit); the repo
 *  is updated by `archmantic feature pull` or the MCP server's auto-pull. */
export function FeatureEditor({ project, feature }: { project: string; feature: FeatureView }) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(feature.description);
  const [shows, setShows] = useState(feature.shows.map((s) => (s.source ? `${s.text} (from ${s.source})` : s.text)).join("\n"));
  const [actions, setActions] = useState(feature.actions.map((a) => (a.description ? `${a.name} — ${a.description}` : a.name)).join("\n"));
  const [deps, setDeps] = useState(feature.dependsOn.join(", "));
  const [status, setStatus] = useState(feature.status ?? "");
  const [saving, setSaving] = useState(false);
  const [savedPending, setSavedPending] = useState(false); // optimistic until the page refetches
  const pending = feature.pending || savedPending;

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/feature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project,
          slug: feature.id.replace(/^feature:/, ""),
          name: feature.name,
          description: desc,
          shows: shows.split("\n"),
          actions: actions.split("\n"),
          dependsOn: deps.split(","),
          components: feature.componentPaths,
          status: status || undefined,
        }),
      });
      if (res.ok) {
        setSavedPending(true);
        setEditing(false);
        toast.success("Saved to cloud", {
          description: "Run `archmantic feature pull` (or restart the MCP server) to write it to the repo.",
          action: { label: "Copy command", onClick: () => navigator.clipboard?.writeText("archmantic feature pull") },
        });
      } else {
        toast.error(`Save failed (${res.status})`);
      }
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : "network error"}`);
    } finally {
      setSaving(false);
    }
  }

  const dialog = (
    <Dialog open={editing} onOpenChange={setEditing}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit feature — {feature.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5">
          <label className="block text-xs text-muted-foreground">Status</label>
          <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="draft | active" className="h-8 text-sm" />
          <label className="block text-xs text-muted-foreground">Description</label>
          <textarea className={ta} rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />
          <label className="block text-xs text-muted-foreground">Shows — one per line, “text (from source)”</label>
          <textarea className={ta} rows={3} value={shows} onChange={(e) => setShows(e.target.value)} />
          <label className="block text-xs text-muted-foreground">Actions — one per line, “name — description”</label>
          <textarea className={ta} rows={3} value={actions} onChange={(e) => setActions(e.target.value)} />
          <label className="block text-xs text-muted-foreground">Depends on — comma-separated feature names</label>
          <Input value={deps} onChange={(e) => setDeps(e.target.value)} className="text-sm" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {dialog}
      <Card className="space-y-2.5 p-4">
      <div className="flex items-center gap-2">
        <span className="font-medium">{feature.name}</span>
        {feature.status ? (
          <Badge variant="outline" className="font-normal capitalize">
            {feature.status}
          </Badge>
        ) : null}
        {feature.human ? (
          <Badge variant="secondary" className="font-normal">
            authored
          </Badge>
        ) : null}
        {pending ? (
          <Badge variant="outline" className="border-warning/40 font-normal text-warning" title="Edited in the app; run `archmantic feature pull` to write it to the repo">
            <RefreshCw className="mr-1 size-3" /> pending pull
          </Badge>
        ) : null}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="ml-auto inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil className="size-3" /> Edit
        </button>
      </div>
      {feature.description ? <p className="text-sm text-muted-foreground">{feature.description}</p> : null}
      {feature.shows.length ? (
        <div className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">Shows</span>
          <ul className="mt-1 space-y-0.5">
            {feature.shows.map((s, i) => (
              <li key={i} className="text-muted-foreground">
                • {s.text}
                {s.source ? <span className="text-xs"> (from {s.source})</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {feature.actions.length ? (
        <div className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">Actions</span>
          <ul className="mt-1 space-y-0.5">
            {feature.actions.map((a, i) => (
              <li key={i} className="text-muted-foreground">
                • <span className="text-foreground">{a.name}</span>
                {a.description ? ` — ${a.description}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {feature.flow.length ? (
        <div className="text-sm">
          <span className="text-xs font-medium text-muted-foreground">Flow</span>
          <ol className="mt-1 space-y-0.5">
            {feature.flow.slice(0, 8).map((s, i) => (
              <li key={i} className="font-mono text-xs text-muted-foreground">
                {s.from} <span className="text-foreground/50">{s.action} →</span> {s.to}
              </li>
            ))}
            {feature.flow.length > 8 ? <li className="text-xs text-muted-foreground">…{feature.flow.length - 8} more</li> : null}
          </ol>
        </div>
      ) : null}
      {feature.dependsOn.length ? (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Depends on:</span>
          {feature.dependsOn.map((d) => (
            <Badge key={d} variant="outline" className="font-normal">
              {d}
            </Badge>
          ))}
        </div>
      ) : null}
      {feature.components.length ? (
        <div className="text-xs text-muted-foreground">
          {feature.components.length} component{feature.components.length === 1 ? "" : "s"}: {feature.components.slice(0, 4).join(", ")}
          {feature.components.length > 4 ? ` +${feature.components.length - 4}` : ""}
        </div>
      ) : null}
      </Card>
    </>
  );
}
