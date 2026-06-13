"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface TokenRow {
  id: string;
  prefix: string | null;
  label: string | null;
  created_at: string;
}

export default function Settings() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [scope, setScope] = useState("");
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<TokenRow | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/tokens");
    if (!res.ok) return;
    const data = await res.json();
    setTokens(data.tokens ?? []);
    setScope(data.scope ?? "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: label || null }),
      });
      const data = await res.json();
      setFresh(data.token);
      setLabel("");
      await load();
      toast.success("Token generated");
    } catch {
      toast.error("Could not generate token");
    } finally {
      setBusy(false);
    }
  }

  async function saveRename() {
    if (!editing) return;
    await fetch("/api/tokens", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: editing.id, label: editLabel }),
    });
    setEditing(null);
    await load();
    toast.success("Renamed");
  }

  async function revoke(t: TokenRow) {
    if (!window.confirm(`Revoke ${t.label || "this token"}? Any CLI using it will stop working.`)) return;
    await fetch(`/api/tokens?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
    await load();
    toast.success("Token revoked");
  }

  const apiUrl = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CLI tokens</h1>
        <p className="text-sm text-muted-foreground">
          Let the <code className="rounded bg-muted px-1 py-0.5">archmantic</code> CLI push to{" "}
          <strong>{scope || "this scope"}</strong> without the database URL. Stored hashed — shown once at creation.
        </p>
      </div>

      <Card className="flex items-center gap-3 p-4">
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. laptop, CI)"
          className="max-w-xs"
        />
        <Button onClick={generate} disabled={busy}>
          {busy ? "Generating…" : "Generate token"}
        </Button>
      </Card>

      {fresh ? (
        <Card className="space-y-3 border-primary/60 p-4">
          <p className="text-sm text-muted-foreground">Copy it now — it won&apos;t be shown again:</p>
          <div className="flex gap-2">
            <code className="flex-1 select-all overflow-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs">
              {fresh}
            </code>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(fresh);
                toast.success("Copied");
              }}
            >
              Copy
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Add to your repo&apos;s .env.local:</p>
          <pre className="overflow-auto rounded-md border bg-muted px-3 py-2 font-mono text-xs">{`ARCHMANTIC_TOKEN=${fresh}\nARCHMANTIC_API_URL=${apiUrl}`}</pre>
          <Button variant="ghost" size="sm" onClick={() => setFresh(null)}>
            Dismiss
          </Button>
        </Card>
      ) : null}

      <div>
        <h2 className="mb-3 text-lg font-semibold">Your tokens</h2>
        {tokens.length === 0 ? (
          <Card className="p-6 text-sm text-muted-foreground">No tokens yet. Generate one above.</Card>
        ) : (
          <Card className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tokens.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      {t.label || <span className="text-muted-foreground">unnamed</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {t.prefix ? `${t.prefix}••••••••` : "arch_••••"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(t);
                          setEditLabel(t.label ?? "");
                        }}
                      >
                        Rename
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revoke(t)}>
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename token</DialogTitle>
          </DialogHeader>
          <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Token label" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <a href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        ← Back to projects
      </a>
    </div>
  );
}
