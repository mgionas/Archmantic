/**
 * MCP usage recorder — the proof-of-value loop (and the metering substrate).
 *
 * Each read tool call is recorded with an estimate of the tokens it returned and
 * the tokens it *saved* vs the agent reading raw files to answer the same thing
 * (the baseline reuses the `bench` heuristic). Events are appended to a durable
 * local log (`.archmantic/usage.jsonl`) and best-effort batch-flushed to the
 * cloud, where the web `/usage` dashboard aggregates them. Cloud failures never
 * surface to the agent; the local log is the source of truth (`usage --sync`
 * re-pushes it, idempotently by event id).
 */
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { walkSourceFiles } from "../analyze/walk.js";
import { type UsageEvent } from "../cloud/store.js";

/** Tools whose file-reading alternative is "scan a lot of the repo". */
const BROAD_TOOLS = new Set([
  "get_context",
  "list_components",
  "search_capabilities",
  "get_data_model",
  "get_api_surface",
  "get_process",
  "get_sequence",
  "suggest_links",
  "whats_related",
  "list_features",
]);

const estTokens = (s: string) => Math.ceil(s.length / 4);

export const USAGE_LOG = join(".archmantic", "usage.jsonl");
const FLUSH_EVERY = 2;
const FLUSH_MS = 20_000;
/** How many trailing local events to re-send on startup (idempotent by id). */
const BACKLOG_LIMIT = 1000;

export class UsageRecorder {
  private buffer: UsageEvent[] = [];
  private srcTokensCache = -1;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private root: string,
    private getProject: () => string,
    private flush: (events: UsageEvent[]) => Promise<void>,
  ) {}

  /** Approx tokens an agent would read to answer broad questions (cached). */
  private srcTokens(): number {
    if (this.srcTokensCache >= 0) return this.srcTokensCache;
    let chars = 0;
    for (const rel of walkSourceFiles(this.root)) {
      try {
        chars += readFileSync(join(this.root, rel), "utf8").length;
      } catch {
        /* skip unreadable */
      }
    }
    this.srcTokensCache = Math.ceil(chars / 4);
    return this.srcTokensCache;
  }

  /** Record one tool call; returns the event (for logging). `answer` is the text returned. */
  record(tool: string, answer: string, now: string): UsageEvent {
    const tokensOut = estTokens(answer);
    const baseline = BROAD_TOOLS.has(tool) ? this.srcTokens() : Math.round(this.srcTokens() * 0.12);
    const event: UsageEvent = {
      id: randomUUID(),
      project: this.getProject(),
      tool,
      tokensOut,
      tokensSaved: Math.max(0, baseline - tokensOut),
      at: now,
    };
    this.appendLocal(event);
    this.buffer.push(event);
    if (this.buffer.length >= FLUSH_EVERY) void this.drain();
    return event;
  }

  private appendLocal(event: UsageEvent): void {
    try {
      mkdirSync(join(this.root, ".archmantic"), { recursive: true });
      appendFileSync(join(this.root, USAGE_LOG), JSON.stringify(event) + "\n", "utf8");
    } catch {
      /* a read-only FS shouldn't break the server */
    }
  }

  /** Flush the buffer to the cloud; on failure, retry next time (id makes it idempotent). */
  private async drain(): Promise<void> {
    if (!this.buffer.length) return;
    const batch = this.buffer;
    this.buffer = [];
    try {
      await this.flush(batch);
    } catch {
      this.buffer.unshift(...batch); // keep for the next attempt
    }
  }

  start(): void {
    this.timer = setInterval(() => void this.drain(), FLUSH_MS);
    this.timer.unref?.(); // don't keep the process alive on our account
  }

  /**
   * Re-send the persisted local log to the cloud on startup. The local log is the
   * durable outbox: events that a previous session recorded but never flushed
   * (short session, hard kill, or creds added later) get caught up here. Idempotent
   * by event id, so re-sending is safe. Returns how many events were re-sent (0 if
   * the log is empty or no cloud creds accepted them). Best-effort — never throws.
   */
  async flushBacklog(): Promise<number> {
    const all = readUsageLog(this.root);
    if (!all.length) return 0;
    const batch = all.slice(-BACKLOG_LIMIT);
    try {
      await this.flush(batch);
      return batch.length;
    } catch {
      return 0; // offline / no creds — the live drain will retry buffered events
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.drain();
  }
}

/** Parse the local usage log into events (for `archmantic usage`). */
export function readUsageLog(root: string): UsageEvent[] {
  try {
    return readFileSync(join(root, USAGE_LOG), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as UsageEvent);
  } catch {
    return [];
  }
}
