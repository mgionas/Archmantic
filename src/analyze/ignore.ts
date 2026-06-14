/**
 * Directories every walker skips — one shared source of truth so the file walk,
 * the structural detectors, and workspace globbing can't drift apart. Dot-dirs
 * (.git, .next, .idea, …) are skipped separately by a `startsWith(".")` check.
 *
 * Covers JS/TS build output and deps plus PHP/Laravel defaults (vendor/, storage/,
 * bootstrap/, tmp/) — without the latter a Laravel repo's Composer `vendor/`
 * floods the API surface with framework routes.
 */
export const IGNORE_DIRS = new Set([
  // JS / TS
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".vercel",
  ".archmantic",
  // PHP / Laravel
  "vendor",
  "storage",
  "bootstrap",
  // generic
  "tmp",
  "temp",
]);
