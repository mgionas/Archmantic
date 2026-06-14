/**
 * Managed-SaaS transport for the cloud store. When `ARCHMANTIC_TOKEN` is set,
 * the CLI pushes/pulls through the web platform's authenticated API (org-scoped)
 * instead of touching Postgres directly — so customers never hold the raw
 * DATABASE_URL. The per-org token is minted in the web app's Settings.
 *
 * `ARCHMANTIC_API_URL` overrides the endpoint (defaults to localhost for dev).
 */
import { type ArchitectureModel } from "../ir/types.js";
import { type UsageEvent } from "./store.js";

export class ApiError extends Error {}

export function hasApiToken(): boolean {
  return Boolean(process.env.ARCHMANTIC_TOKEN);
}

function baseUrl(): string {
  return (process.env.ARCHMANTIC_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function authHeader(): Record<string, string> {
  return { authorization: `Bearer ${process.env.ARCHMANTIC_TOKEN ?? ""}` };
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${baseUrl()}${path}`, init);
  } catch (err) {
    throw new ApiError(`could not reach the Archmantic API at ${baseUrl()} — ${err instanceof Error ? err.message : err}`);
  }
}

/** Guard against an auth redirect (HTML) being mistaken for a JSON API response. */
function assertJson(res: Response, action: string): void {
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("application/json")) {
    throw new ApiError(
      `${action} did not reach the API (got ${ct || "non-JSON"} from ${baseUrl()}). ` +
        `Check ARCHMANTIC_API_URL and that the deployment is current (the API route must be reachable).`,
    );
  }
}

export async function pushModelApi(model: ArchitectureModel, commit: string): Promise<void> {
  const res = await send("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify({ model, commit }),
  });
  if (!res.ok) throw new ApiError(`push failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  assertJson(res, "push");
}

export async function pullLatestApi(project: string): Promise<ArchitectureModel | null> {
  const res = await send(`/api/pull?project=${encodeURIComponent(project)}`, { headers: authHeader() });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(`pull failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  assertJson(res, "pull");
  const data = (await res.json()) as { model?: ArchitectureModel };
  return data.model ?? null;
}

/** Fetch the org's latest model per project (for cross-repo link suggestions). */
export async function listModelsApi(): Promise<ArchitectureModel[]> {
  const res = await send("/api/models", { headers: authHeader() });
  if (!res.ok) throw new ApiError(`list models failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  assertJson(res, "list models");
  const data = (await res.json()) as { models?: ArchitectureModel[] };
  return data.models ?? [];
}

/** Record a batch of MCP usage events through the org-scoped API (idempotent). */
export async function recordUsageApi(events: UsageEvent[]): Promise<void> {
  if (!events.length) return;
  const res = await send("/api/usage", {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify({ events }),
  });
  if (!res.ok) throw new ApiError(`usage record failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  assertJson(res, "usage");
}

/** Fetch the org's human-edited BPMN for a project (null if none saved). */
export async function pullProcessEditApi(project: string): Promise<string | null> {
  const res = await send(`/api/process-edit?project=${encodeURIComponent(project)}`, { headers: authHeader() });
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(`fetch edit failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  assertJson(res, "fetch edit");
  const data = (await res.json()) as { xml?: string };
  return data.xml ?? null;
}
