"use client";

import { useRef, useState, type ReactNode } from "react";
import { TransformWrapper, TransformComponent, type ReactZoomPanPinchContentRef } from "react-zoom-pan-pinch";
import { Plus, Minus, RotateCcw, Maximize2, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function ToolBtn({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

/**
 * Interactive canvas for any SVG diagram (Mermaid/ERD): pan + wheel/pinch zoom,
 * with a toolbar (zoom ±, reset, copy source, fullscreen). Fills its parent —
 * give the parent a height.
 */
export function DiagramCanvas({
  children,
  source,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  source?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ReactZoomPanPinchContentRef>(null);
  const [scale, setScale] = useState(1);

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }
  async function copySource() {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      toast.success("Diagram source copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      className={cn("relative h-full w-full overflow-hidden rounded-lg border border-border/60 bg-canvas", className)}
    >
      <div className="absolute right-2 top-2 z-10 flex items-center gap-0.5 rounded-lg border border-border/60 bg-background/80 p-0.5 backdrop-blur">
        <span className="px-1.5 text-xs tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
        <ToolBtn onClick={() => apiRef.current?.zoomOut()} label="Zoom out">
          <Minus className="size-4" />
        </ToolBtn>
        <ToolBtn onClick={() => apiRef.current?.zoomIn()} label="Zoom in">
          <Plus className="size-4" />
        </ToolBtn>
        <ToolBtn onClick={() => apiRef.current?.resetTransform()} label="Reset view">
          <RotateCcw className="size-4" />
        </ToolBtn>
        {source ? (
          <ToolBtn onClick={copySource} label="Copy diagram source">
            <Copy className="size-4" />
          </ToolBtn>
        ) : null}
        <ToolBtn onClick={toggleFullscreen} label="Fullscreen">
          <Maximize2 className="size-4" />
        </ToolBtn>
      </div>
      <TransformWrapper
        ref={apiRef}
        minScale={0.2}
        maxScale={8}
        centerOnInit
        limitToBounds={false}
        wheel={{ step: 0.08 }}
        onTransform={(_ref, state) => setScale(state.scale)}
      >
        <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
          {children}
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
