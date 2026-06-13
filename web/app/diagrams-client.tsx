"use client";

import { useEffect, useRef, useState } from "react";

/** Render Mermaid source to SVG, client-side (mermaid is browser-only). */
export function Mermaid({ id, chart }: { id: string; chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "loose" });
        const { svg } = await mermaid.render(`mmd-${id}`, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "render error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, chart]);

  if (error) return <pre style={{ color: "#f87171", fontSize: 12 }}>diagram error: {error}</pre>;
  return <div ref={ref} style={{ overflow: "auto" }} />;
}

/** Editable BPMN canvas (bpmn-js Modeler) with save — the edit-then-build moat. */
export function BpmnEditor({ project, initialXml }: { project: string; initialXml: string }) {
  const ref = useRef<HTMLDivElement>(null);
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
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <button
          onClick={save}
          style={{
            background: "#7aa2f7",
            color: "#0f1115",
            border: 0,
            borderRadius: 8,
            padding: "7px 13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save process
        </button>
        <span className="text-sm text-muted-foreground">
          {status || "Drag, rename (double-click), and connect tasks — then save."}
        </span>
      </div>
      <div ref={ref} style={{ height: 460, background: "#fff", borderRadius: 12 }} />
    </div>
  );
}

/** Render BPMN 2.0 XML with bpmn-js, client-side (read-only). */
export function Bpmn({ xml }: { xml: string }) {
  const ref = useRef<HTMLDivElement>(null);

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
        /* ignore render errors */
      }
    })();
    return () => {
      cancelled = true;
      viewer?.destroy();
    };
  }, [xml]);

  return <div ref={ref} style={{ height: 420, background: "#fff", borderRadius: 12 }} />;
}
