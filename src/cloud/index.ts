/** Cloud knowledge store — shared team model + per-commit history over Neon. */
export {
  pushModel,
  pullLatest,
  history,
  listLatestModels,
  ensureSchema,
  recordUsage,
  ensureUsageSchema,
  NoDatabaseError,
  type CloudSnapshot,
  type UsageEvent,
} from "./store.js";
export {
  hasApiToken,
  pushModelApi,
  pullLatestApi,
  pullProcessEditApi,
  listModelsApi,
  recordUsageApi,
  ApiError,
} from "./api.js";

import { recordUsage, type UsageEvent } from "./store.js";
import { hasApiToken, recordUsageApi } from "./api.js";

/**
 * Best-effort flush of usage events to wherever creds point: org-scoped API if a
 * token is set, else direct DB if DATABASE_URL, else nowhere (local log only).
 * Shared by the MCP server and the CLI push path. Never throws on no-creds.
 */
export async function flushUsageEvents(events: UsageEvent[]): Promise<void> {
  if (!events.length) return;
  if (hasApiToken()) await recordUsageApi(events);
  else if (process.env.DATABASE_URL) await recordUsage(events);
}
