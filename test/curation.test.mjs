// Curate layer — read/apply/write curation overlay onto the model. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readCuration, applyCuration, writeCuration, uncuratedDomains } from "../dist/project/curation.js";

function tmp() {
  return mkdtempSync(join(tmpdir(), "archmantic-curation-"));
}

/** A model with two domain groups (deterministic names). */
function model() {
  const domain = (slug, name, members) => ({
    id: `group:domain:${slug}`,
    name,
    kind: "domain",
    members,
    provenance: [{ source: "code", ref: members[0].replace(/^comp:/, ""), confidence: 0.85 }],
    confidence: 0.85,
  });
  return {
    project: "demo",
    systems: [],
    components: [],
    groups: [domain("analyze", "Analyze", ["comp:src/analyze/a.ts"]), domain("mcp", "Mcp", ["comp:src/mcp/b.ts"])],
    actors: [],
    relations: [],
    flows: [],
    processes: [],
    capabilities: [],
    technologies: [],
    dataEntities: [],
    endpoints: [],
    features: [],
  };
}

test("applyCuration overlays narrative + domain name/description, marks provenance", () => {
  const m = model();
  applyCuration(m, {
    overview: "Demo is a tiered analyzer.",
    domains: { analyze: { name: "Analysis pipeline", description: "Reverse-engineers the model." } },
  });
  assert.equal(m.narrative, "Demo is a tiered analyzer.");
  const a = m.groups.find((g) => g.id === "group:domain:analyze");
  assert.equal(a.name, "Analysis pipeline");
  assert.equal(a.description, "Reverse-engineers the model.");
  assert.equal(a.provenance[0].ref, ".archmantic/curation.json", "curated → curation provenance");
  // untouched domain keeps its deterministic name + code provenance
  const mcp = m.groups.find((g) => g.id === "group:domain:mcp");
  assert.equal(mcp.name, "Mcp");
  assert.equal(mcp.provenance[0].source, "code");
});

test("uncuratedDomains lists domains without a curated name", () => {
  const m = model();
  assert.deepEqual(uncuratedDomains(m, {}).sort(), ["analyze", "mcp"]);
  assert.deepEqual(uncuratedDomains(m, { domains: { analyze: { name: "Analysis" } } }), ["mcp"]);
});

test("read/write round-trip: writeCuration merges, readCuration parses", () => {
  const root = tmp();
  try {
    mkdirSync(join(root, ".archmantic"), { recursive: true });
    writeCuration(root, { overview: "First.", domains: { analyze: { name: "Analysis" } } });
    let c = readCuration(root);
    assert.equal(c.overview, "First.");
    assert.equal(c.domains.analyze.name, "Analysis");
    // a second write merges (doesn't clobber) other domains + keeps prior overview if omitted
    writeCuration(root, { domains: { mcp: { name: "MCP server" } } });
    c = readCuration(root);
    assert.equal(c.overview, "First.", "overview preserved when omitted");
    assert.equal(c.domains.analyze.name, "Analysis", "prior domain preserved");
    assert.equal(c.domains.mcp.name, "MCP server", "new domain merged");
    // the file is valid pretty JSON
    JSON.parse(readFileSync(join(root, ".archmantic", "curation.json"), "utf8"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readCuration on a missing/empty repo returns an empty doc", () => {
  const root = tmp();
  try {
    assert.deepEqual(readCuration(root), {});
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
