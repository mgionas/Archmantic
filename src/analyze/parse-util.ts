/** Tiny text helpers shared by the Drizzle/SQL data-model parsers. */

/**
 * Given `text` where `text[openIdx]` is an opening bracket, return the substring
 * between it and its matching close bracket (exclusive). Bracket-depth aware;
 * does not track string literals (fine for schema field blocks).
 */
export function balancedBlock(text: string, openIdx: number, open: string, close: string): string {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const ch = text[i];
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(openIdx + 1, i);
    }
  }
  return text.slice(openIdx + 1);
}

/** Split on top-level commas only (ignoring commas nested in (), [], {}). */
export function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) out.push(cur);
  return out;
}
