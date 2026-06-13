/**
 * Trust layer (USP 3) — turn provenance + confidence into a verifiable surface.
 *
 * Every projected element can show "grounded in N refs" and a confidence band;
 * low-confidence elements are flagged so a human (or the Tier-2 pass) knows where
 * to look. This is the differentiator: the rest of the AI-diagram field ships
 * ungrounded output.
 */
import { type Provenance } from "../ir/types.js";

export interface Grounded {
  provenance: Provenance[];
  confidence: number;
}

/** Below this, an element is "needs review" and gets flagged in every view. */
export const LOW_CONFIDENCE = 0.6;

export type ConfidenceBand = "high" | "medium" | "low";

export function band(confidence: number): ConfidenceBand {
  if (confidence >= 0.85) return "high";
  if (confidence >= LOW_CONFIDENCE) return "medium";
  return "low";
}

export function refCount(el: Grounded): number {
  return el.provenance.length;
}

/** Unique source files/refs backing an element (provenance may repeat a file). */
export function refs(el: Grounded): string[] {
  return [...new Set(el.provenance.map((p) => p.ref))];
}

export function isLowConfidence(el: Grounded): boolean {
  return el.confidence < LOW_CONFIDENCE;
}

/** "grounded in 3 refs · medium confidence" */
export function badge(el: Grounded): string {
  const n = refCount(el);
  return `grounded in ${n} ref${n === 1 ? "" : "s"} · ${band(el.confidence)} confidence`;
}

export interface TrustSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  /** Mean confidence across the counted elements, 0..1. */
  meanConfidence: number;
  /** Total provenance references backing the whole model. */
  totalRefs: number;
}

export function summarize(elements: Grounded[]): TrustSummary {
  const s: TrustSummary = { total: 0, high: 0, medium: 0, low: 0, meanConfidence: 0, totalRefs: 0 };
  if (!elements.length) return s;
  let sum = 0;
  for (const el of elements) {
    s.total++;
    s[band(el.confidence)]++;
    s.totalRefs += refCount(el);
    sum += el.confidence;
  }
  s.meanConfidence = sum / s.total;
  return s;
}
