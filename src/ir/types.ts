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

/** A detected technology/framework — the "what is this built with?" layer. */
export interface Technology extends ElementBase {
  /** framework | ui | database | orm | auth | ai | testing | build | language | infra | library */
  category: string;
}

/** One column/field on a DataEntity. */
export interface DataField {
  name: string;
  /** scalar type (String, Int, DateTime…), an enum name, or a related entity's name. */
  type: string;
  /** nullable. */
  optional?: boolean;
  /** to-many (array). */
  list?: boolean;
  /** part of the primary key. */
  isId?: boolean;
  /** has a uniqueness constraint. */
  isUnique?: boolean;
  /** set when this field is a relation to another entity — the target entity id. */
  relationTo?: string;
  /** scalar foreign-key column (named in a relation's `fields: [...]`). */
  isForeignKey?: boolean;
}

/** A persisted data model entity (DB table / ORM model) — projects to an ERD. */
export interface DataEntity extends ElementBase {
  fields: DataField[];
}

/** The whole model for one project. */
export interface ArchitectureModel {
  schemaVersion: typeof SCHEMA_VERSION;
  project: string;
  /** ISO timestamp; stamped by the caller (kept out of pure helpers). */
  generatedAt?: string;
  /** Optional: the multi-repo system this project belongs to (from config). */
  system?: string;
  /** Optional: sibling services this project calls (declared in config). */
  consumes?: string[];
  systems: System[];
  components: Component[];
  actors: Actor[];
  relations: Relation[];
  flows: Flow[];
  processes: Process[];
  capabilities: Capability[];
  technologies: Technology[];
  dataEntities: DataEntity[];
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
    technologies: [...m.technologies].sort(byId),
    dataEntities: [...m.dataEntities].sort(byId),
  };
}

/** Recursively sort object keys so serialization is byte-stable regardless of
 *  source — a fresh analyze, an incremental patch, or a DB round-trip (Postgres
 *  JSONB reorders keys). Combined with sortModel's array ordering, this makes
 *  `model.json` deterministic → churn-free committed IR. */
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, sortKeys(obj[k])]));
  }
  return value;
}

/** Canonical, byte-stable serialization of a model for writing to disk. */
export function serializeModel(m: ArchitectureModel): string {
  return JSON.stringify(sortKeys(sortModel(m)), null, 2) + "\n";
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
    technologies: [],
    dataEntities: [],
  };
}
