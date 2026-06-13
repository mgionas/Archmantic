/**
 * Capability map (USP 1: plain-English "what can this system do?").
 *
 * Groups the derived Capabilities by the folder of their implementing component,
 * so a PM/architect/new-hire reads areas of the system, not a symbol dump. Each
 * capability keeps its trust badge (USP 3).
 */
import { type ArchitectureModel, type Capability } from "../ir/types.js";
import { badge, isLowConfidence } from "./trust.js";

export interface CapabilityGroup {
  area: string;
  capabilities: Capability[];
}

function areaOf(cap: Capability): string {
  const compId = cap.componentIds[0] ?? "";
  const rel = compId.slice("comp:".length);
  const parts = rel.split("/");
  // Folder of the file (drop the filename); fall back to repo root.
  return parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";
}

export function groupCapabilities(model: ArchitectureModel): CapabilityGroup[] {
  const byArea = new Map<string, Capability[]>();
  for (const cap of model.capabilities) {
    const area = areaOf(cap);
    (byArea.get(area) ?? byArea.set(area, []).get(area)!).push(cap);
  }
  return [...byArea.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([area, capabilities]) => ({ area, capabilities }));
}

/** Plain-text capability map for the terminal. */
export function capabilityMapText(model: ArchitectureModel): string {
  const groups = groupCapabilities(model);
  if (!groups.length) return "  (no capabilities derived yet)";
  const out: string[] = [];
  for (const g of groups) {
    out.push(`  ${g.area}/`);
    for (const cap of g.capabilities) {
      const flag = isLowConfidence(cap) ? " ⚠" : "";
      out.push(`    • ${cap.name}${flag}  —  ${badge(cap)}`);
    }
  }
  return out.join("\n");
}
