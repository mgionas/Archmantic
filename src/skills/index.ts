/**
 * Skills layer barrel — load the shelf (builtin + local), resolve it against the
 * model, fetch remote skills on demand, and render compact grounded text for the
 * MCP tools and the CLI. The model-driven recommender for reusable playbooks.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type ArchitectureModel } from "../ir/types.js";
import { BUILTIN_SKILLS } from "./catalog.js";
import { parseSkillFile, skillFileMarkdown, skillSlug } from "./parse.js";
import { resolveSkills } from "./resolve.js";
import { type Skill, type SkillMatch } from "./types.js";

export { BUILTIN_SKILLS } from "./catalog.js";
export { resolveSkills, scoreSkill } from "./resolve.js";
export { parseSkillFile, skillFileMarkdown, skillSlug, parseTrigger } from "./parse.js";
export type { Skill, SkillMatch, SkillTrigger, SkillSource } from "./types.js";

export const SKILLS_DIR = join(".archmantic", "skills");

/** Read authored/fetched skills from `.archmantic/skills/`. */
export function readLocalSkills(root: string): Skill[] {
  const dir = join(root, SKILLS_DIR);
  let files: string[];
  try {
    files = readdirSync(dir).filter((n) => n.endsWith(".md"));
  } catch {
    return [];
  }
  const out: Skill[] = [];
  for (const file of files.sort()) {
    try {
      const slug = file.replace(/\.md$/, "");
      out.push(parseSkillFile(readFileSync(join(dir, file), "utf8"), slug, join(SKILLS_DIR, file)));
    } catch {
      /* skip unparseable */
    }
  }
  return out;
}

/** The full shelf: builtin catalog plus local skills (local overrides builtin by id). */
export function allSkills(root: string): Skill[] {
  const byId = new Map<string, Skill>();
  for (const s of BUILTIN_SKILLS) byId.set(s.id, s);
  for (const s of readLocalSkills(root)) byId.set(s.id, s); // local wins
  return [...byId.values()];
}

/** Resolve a loose name (id, slug, or display name) to a skill. */
export function findSkill(skills: Skill[], name: string): Skill | undefined {
  const n = name.trim().toLowerCase();
  const slug = skillSlug(n);
  return (
    skills.find((s) => s.id === name) ??
    skills.find((s) => s.id === `skill:${slug}`) ??
    skills.find((s) => s.name.toLowerCase() === n)
  );
}

/**
 * Pull a remote skill from the shelf into the local cache. Fetches a markdown
 * skill definition over HTTP and writes it to `.archmantic/skills/<slug>.md`.
 * Data only — nothing is executed; the agent/human decides whether to apply it.
 */
export async function addRemoteSkill(root: string, url: string): Promise<{ slug: string; file: string; skill: Skill }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  const tmp = parseSkillFile(text, "remote", url); // parse once to learn the name
  const slug = skillSlug(tmp.name);
  const dir = join(root, SKILLS_DIR);
  mkdirSync(dir, { recursive: true });
  const file = join(SKILLS_DIR, `${slug}.md`);
  // Keep a provenance line so the file records where it was pulled from.
  const content = text.includes("<!-- archmantic:source") ? text : `<!-- archmantic:source ${url} -->\n${text}`;
  writeFileSync(join(root, file), content, "utf8");
  return { slug, file, skill: { ...parseSkillFile(content, slug, url), origin: url } };
}

// ── Text rendering (compact, grounded) for the MCP tools + CLI ────────────────

/** `suggest_skills`: model-ranked recommendations with the reason each matched. */
export function renderSuggestions(model: ArchitectureModel, skills: Skill[], limit = 6): string {
  const matches = resolveSkills(model, skills).slice(0, limit);
  if (!matches.length) return "No skills matched this project. Add one with `archmantic skill add <url>`.";
  const out = [`Recommended skills for "${model.project}" (${matches.length} of ${skills.length} on the shelf):`];
  for (const m of matches) {
    const slug = m.skill.id.replace(/^skill:/, "");
    out.push(
      `\n★ ${m.skill.name}  [${m.skill.source}]${m.skill.agent ? ` · agent: ${m.skill.agent}` : ""}` +
        `${m.skill.description ? `\n  ${m.skill.description}` : ""}` +
        `\n  why: ${m.reasons.join("; ") || "matched"}` +
        `\n  use: \`archmantic skill show ${slug}\` (or call get_skill)`,
    );
  }
  return out.join("\n");
}

/** `list_skills`: the whole shelf with source, tags, and triggers. */
export function renderSkillList(skills: Skill[]): string {
  if (!skills.length) return "No skills available.";
  const builtin = skills.filter((s) => s.source === "builtin").length;
  const local = skills.length - builtin;
  const out = [`Skills (${skills.length} on the shelf — ${builtin} builtin, ${local} local):`];
  for (const s of [...skills].sort((a, b) => a.name.localeCompare(b.name))) {
    const when = s.when.map((t) => (t.value ? `${t.kind}:${t.value}` : t.kind)).join(", ");
    out.push(
      `- ${s.name} [${s.source}]${s.tags.length ? ` {${s.tags.join(", ")}}` : ""}` +
        `${s.description ? ` — ${s.description}` : ""}  (when: ${when})`,
    );
  }
  return out.join("\n");
}

/** `get_skill`: one skill's full playbook — the payload an agent applies. */
export function renderSkill(skill: Skill): string {
  const when = skill.when.map((t) => (t.value ? `${t.kind}:${t.value}` : t.kind)).join(", ");
  return [
    `Skill: ${skill.name}  [${skill.source}]`,
    skill.description ?? "",
    skill.agent ? `Agent: ${skill.agent}` : "",
    `Tags: ${skill.tags.join(", ") || "—"}`,
    `Applies when: ${when}`,
    `Source: ${skill.origin}`,
    ``,
    skill.body ?? "(no playbook body)",
  ]
    .filter((l) => l !== "")
    .join("\n");
}
