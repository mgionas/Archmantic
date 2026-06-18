/**
 * Parse a skill markdown file (frontmatter + playbook body) into a Skill. Mirrors
 * the feature-file parser: a `---` frontmatter block, then the body is the playbook.
 *
 * Frontmatter keys: name, description, agent, tags, when.
 * `when` is a list of trigger predicates, `kind` or `kind:value`:
 *   when: [tech:laravel, external:stripe, entity, role:page]
 */
import { type Skill, type SkillTrigger } from "./types.js";

const TRIGGER_KINDS = new Set<SkillTrigger["kind"]>([
  "tech", "category", "external", "role", "entity", "endpoint", "feature", "process", "monorepo", "always",
]);

export const skillSlug = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "skill";

/** Parse a comma/inline-array list: `[a, b]` or `a, b`. */
function parseList(raw: string): string[] {
  return raw
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

/** Parse one `kind` or `kind:value` token into a trigger (unknown kinds dropped). */
export function parseTrigger(token: string): SkillTrigger | null {
  const [rawKind, ...rest] = token.split(":");
  const kind = rawKind!.trim().toLowerCase() as SkillTrigger["kind"];
  if (!TRIGGER_KINDS.has(kind)) return null;
  const value = rest.join(":").trim();
  return value ? { kind, value } : { kind };
}

/** Parse one skill markdown file into a Skill. `origin` records where it came from. */
export function parseSkillFile(text: string, slug: string, origin: string): Skill {
  let name = slug;
  let description: string | undefined;
  let agent: string | undefined;
  let tags: string[] = [];
  const when: SkillTrigger[] = [];
  let body = text;

  const fm = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(text);
  if (fm) {
    body = text.slice(fm[0].length);
    for (const line of fm[1]!.split("\n")) {
      const kv = /^([A-Za-z_]+)\s*:\s*(.+?)\s*$/.exec(line);
      if (!kv) continue;
      const key = kv[1]!.toLowerCase();
      const val = kv[2]!.replace(/^['"]|['"]$/g, "");
      if (key === "name") name = val;
      else if (key === "description") description = val;
      else if (key === "agent") agent = val;
      else if (key === "tags") tags = parseList(val);
      else if (key === "when") {
        for (const tok of parseList(kv[2]!)) {
          const t = parseTrigger(tok);
          if (t) when.push(t);
        }
      }
    }
  }

  body = body.trim();
  return {
    id: `skill:${slug}`,
    name,
    description,
    body: body || undefined,
    source: "local",
    origin,
    agent,
    when: when.length ? when : [{ kind: "always" }],
    tags,
  };
}

/** Render a Skill as an editable `.archmantic/skills/<slug>.md` file. */
export function skillFileMarkdown(s: Skill): string {
  const when = s.when.map((t) => (t.value ? `${t.kind}:${t.value}` : t.kind)).join(", ");
  const fm = [`name: ${s.name}`];
  if (s.description) fm.push(`description: ${s.description}`);
  if (s.agent) fm.push(`agent: ${s.agent}`);
  if (s.tags.length) fm.push(`tags: [${s.tags.join(", ")}]`);
  fm.push(`when: [${when}]`);
  return [`---`, ...fm, `---`, ``, s.body ?? "Describe the playbook for this skill.", ``].join("\n");
}
