"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/** The shared agent-knowledge summary (same text as AGENTS.md), readable + copyable. */
export function KnowledgeView({ text }: { text: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Knowledge copied — paste into AGENTS.md");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-muted-foreground">
          The grounded agent-context summary for this project — the same text Archmantic writes to{" "}
          <code className="rounded bg-muted px-1.5 py-0.5">AGENTS.md</code>. Any agent that reads a repo context file
          (Cursor, Copilot, plain LLMs) gets exactly this; here your team can read or copy it.
        </p>
        <Button size="sm" variant="outline" onClick={copy} className="shrink-0">
          Copy
        </Button>
      </div>
      <Card className="overflow-auto p-4">
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">{text}</pre>
      </Card>
    </div>
  );
}
