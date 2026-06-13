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

/** Render BPMN 2.0 XML with bpmn-js, client-side. */
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
