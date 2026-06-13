/** Architecture diff: drift detection (USP 4) + PR architecture diff (USP 5). */
export * from "./model-diff.js";
export { analyzeAtRef, resolveRef, GitRefError } from "./snapshot.js";
export { architectureLog, type CommitArchChange } from "./history.js";
