/**
 * Archmantic — the Architecture Model (IR).
 *
 * The IR is the product. Diagrams (context / sequence / BPMN) are *projections*
 * of this model; the MCP server answers queries over it. See docs/ARCHITECTURE.md §2.
 *
 * Design invariant: every derived element carries `provenance` (where it came
 * from) and `confidence` (how sure we are). Human-authored elements use
 * provenance `{ source: "human" }`. Nothing derived is allowed in without a ref.
 */

export const SCHEMA_VERSION = "0.1.0" as const;

/** Where a piece of the model was derived from. */
export type SourceKind = "repo" | "code" | "runtime" | "docs" | "human";

/** A single grounding for an element: which source, which exact reference. */
export interface Provenance {
  source: SourceKind;
  /** e.g. "src/pay/charge.ts:42", a commit sha, a trace id, or "manual-edit". */
  ref: string;
  /** Confidence contributed by this specific source, 0..1. */
  confidence?: number;
}

/** 0..1 — drives the trust surface and tier escalation (low → analyze deeper). */
export type Confidence = number;

interface ElementBase {
  id: string;
  name: string;
  description?: string;
  /** Required on derived elements; `[{ source: "human" }]` for hand edits. */
  provenance: Provenance[];
  /** Aggregate confidence for the element, 0..1. */
  confidence: Confidence;
}

export interface System extends ElementBase {
  kind: "internal" | "external";
}

export interface Component extends ElementBase {
  /** service | module | package | layer | etc. — kept open for now. */
  kind: string;
  /** id of the System this belongs to. */
  systemId?: string;
  /** One-line statement of what this component is responsible for. */
  responsibility?: string;
}

export interface Actor extends ElementBase {
  kind: "user" | "external_system" | "scheduler" | "other";
}

export type RelationKind =
  | "calls"
  | "depends_on"
  | "publishes_to"
  | "subscribes_to"
  | "reads"
  | "writes";

export interface Relation extends ElementBase {
  from: string; // element id
  to: string; // element id
  kind: RelationKind;
}

export interface FlowStep {
  /** participant element id (component/actor/system). */
  participant: string;
  /** what happens at this step. */
  action: string;
  /** optional target participant id (for a message/call). */
  to?: string;
  provenance: Provenance[];
}

/** An ordered sequence — projects to a sequence diagram. */
export interface Flow extends ElementBase {
  participants: string[];
  steps: FlowStep[];
}

/** A business process — projects to BPMN 2.0. */
export interface Process extends ElementBase {
  /** kept loose for v0; will gain tasks/gateways/events/lanes. */
  tasks: { id: string; name: string; provenance: Provenance[] }[];
}

/** A plain-English feature/capability — the "what can this system do?" layer. */
export interface Capability extends ElementBase {
  /** ids of components that implement this capability. */
  componentIds: string[];
}

/** The whole model for one project. */
export interface ArchitectureModel {
  schemaVersion: typeof SCHEMA_VERSION;
  project: string;
  /** ISO timestamp; stamped by the caller (kept out of pure helpers). */
  generatedAt?: string;
  systems: System[];
  components: Component[];
  actors: Actor[];
  relations: Relation[];
  flows: Flow[];
  processes: Process[];
  capabilities: Capability[];
}

/**
 * Canonical ordering for serialization: sort element arrays by id so a full
 * `analyze` and an incremental `update` produce byte-identical `model.json` for
 * identical code — keeping the committed IR churn-free and PR diffs clean.
 * Process/flow internal order (tasks, steps) is meaningful, so it's preserved.
 */
export function sortModel(m: ArchitectureModel): ArchitectureModel {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  return {
    ...m,
    systems: [...m.systems].sort(byId),
    components: [...m.components].sort(byId),
    actors: [...m.actors].sort(byId),
    relations: [...m.relations].sort(byId),
    capabilities: [...m.capabilities].sort(byId),
  };
}

/** A fresh, empty model for `archmantic init`. */
export function createEmptyModel(project: string): ArchitectureModel {
  return {
    schemaVersion: SCHEMA_VERSION,
    project,
    systems: [],
    components: [],
    actors: [],
    relations: [],
    flows: [],
    processes: [],
    capabilities: [],
  };
}
