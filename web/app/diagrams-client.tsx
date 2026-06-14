"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Plus, Minus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Minimal toolbar driving a bpmn-js canvas service (fit / zoom / fullscreen). */
function BpmnToolbar({ onFit, onIn, onOut, onFull }: { onFit: () => void; onIn: () => void; onOut: () => void; onFull: () => void }) {
  const btn = "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
  return (
    <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/80 p-0.5 backdrop-blur">
      <button type="button" onClick={onOut} title="Zoom out" aria-label="Zoom out" className={btn}>
        <Minus className="size-4" />
      </button>
      <button type="button" onClick={onIn} title="Zoom in" aria-label="Zoom in" className={btn}>
        <Plus className="size-4" />
      </button>
      <button type="button" onClick={onFit} title="Fit" aria-label="Fit to viewport" className={btn}>
        <RotateCcw className="size-4" />
      </button>
      <button type="button" onClick={onFull} title="Fullscreen" aria-label="Fullscreen" className={btn}>
        <Maximize2 className="size-4" />
      </button>
    </div>
  );
}

/** Editable BPMN canvas (bpmn-js Modeler) with save — the edit-then-build moat. */
export function BpmnEditor({ project, initialXml }: { project: string; initialXml: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modelerRef = useRef<any>(null);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let modeler: any = null;
    let cancelled = false;
    (async () => {
      const Modeler = (await import("bpmn-js/lib/Modeler")).default;
      if (cancelled || !ref.current) return;
      modeler = new Modeler({ container: ref.current });
      modelerRef.current = modeler;
      try {
        await modeler.importXML(initialXml);
        modeler.get("canvas").zoom("fit-viewport");
      } catch {
        setStatus("Could not load the diagram.");
      }
    })();
    return () => {
      cancelled = true;
      modeler?.destroy?.();
      modelerRef.current = null;
    };
  }, [initialXml]);

  const canvas = () => modelerRef.current?.get("canvas");
  const fit = () => canvas()?.zoom("fit-viewport");
  const zoomBy = (d: number) => {
    const c = canvas();
    if (c) c.zoom(Math.max(0.2, c.zoom() + d));
  };
  const fullscreen = () => {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  async function save() {
    const modeler = modelerRef.current;
    if (!modeler) return;
    setStatus("Saving…");
    try {
      const { xml } = await modeler.saveXML({ format: true });
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project, xml }),
      });
      setStatus(res.ok ? "Saved ✓ — this is now your org's process" : `Save failed (${res.status})`);
    } catch {
      setStatus("Save failed");
    }
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-3">
        <Button onClick={save} size="sm">
          Save process
        </Button>
        <span className="text-sm text-muted-foreground">
          {status || "Drag, rename (double-click), and connect tasks — then save."}
        </span>
      </div>
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border/60 bg-canvas">
        <BpmnToolbar onFit={fit} onIn={() => zoomBy(0.2)} onOut={() => zoomBy(-0.2)} onFull={fullscreen} />
        <div ref={ref} className="h-full w-full" />
      </div>
    </div>
  );
}

/** Render BPMN 2.0 XML with bpmn-js, client-side (read-only). */
export function Bpmn({ xml }: { xml: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let viewer: { importXML: (x: string) => Promise<unknown>; get: (s: string) => { zoom: (m: string) => void }; destroy: () => void } | null =
      null;
    let cancelled = false;
    (async () => {
      const NavigatedViewer = (await import("bpmn-js/lib/NavigatedViewer")).default;
      if (cancelled || !ref.current) return;
      viewer = new NavigatedViewer({ container: ref.current });
      try {
        await viewer.importXML(xml);
        viewer.get("canvas").zoom("fit-viewport");
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [xml]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-danger/30 bg-danger/5 p-6 text-sm text-danger">
        Could not render the process diagram.
      </div>
    );
  }
  return <div ref={ref} className="h-full w-full overflow-hidden rounded-lg border border-border/60 bg-canvas" />;
}
