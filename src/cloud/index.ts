/** Cloud knowledge store — shared team model + per-commit history over Neon. */
export {
  pushModel,
  pullLatest,
  history,
  ensureSchema,
  NoDatabaseError,
  type CloudSnapshot,
} from "./store.js";
