// Feature layer (spec layer phase 2). Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  parseFeatureFile,
  seedFeatures,
  mergeFeatures,
  readFeatures,
  seedFeatureFiles,
  slugify,
} from "../dist/project/features.js";

function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-feat-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const parts = rel.split("/");
      if (parts.length > 1) mkdirSync(join(dir, ...parts.slice(0, -1)), { recursive: true });
      writeFileSync(join(dir, ...parts), content);
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const FILE = [
  "---",
  "name: Home",
  "status: active",
  "dependsOn: [Login, Vendors]",
  "components: [resources/js/Pages/Home.vue]",
  "---",
  "",
  "The landing page.",
  "",
  "## Shows",
  "- hero slider (from admin)",
  "- vendors section",
  "",
  "## Actions",
  "- browse vendors — opens the listing",
  "- search",
  "",
].join("\n");

test("parses frontmatter, description, shows (with source), and actions", () => {
  const f = parseFeatureFile(FILE, "home");
  assert.equal(f.id, "feature:home");
  assert.equal(f.name, "Home");
  assert.equal(f.status, "active");
  assert.equal(f.description, "The landing page.");
  assert.deepEqual(f.shows[0], { text: "hero slider", source: "admin" });
  assert.equal(f.shows[1].text, "vendors section");
  assert.deepEqual(f.actions[0], { name: "browse vendors", description: "opens the listing" });
  assert.equal(f.actions[1].name, "search");
  assert.deepEqual(f.dependsOn, ["feature:login", "feature:vendors"]);
  assert.deepEqual(f.components, ["comp:resources/js/Pages/Home.vue"]);
  assert.equal(f.provenance[0].source, "human");
});

test("slugify normalizes names", () => {
  assert.equal(slugify("Vendor Profile"), "vendor-profile");
  assert.equal(slugify("Home!!"), "home");
});

test("seedFeatures derives one feature per page/route/view component", () => {
  const model = {
    components: [
      { id: "comp:resources/js/Pages/Home.vue", role: "page", responsibility: "Home page" },
      { id: "comp:resources/js/Pages/Vendors.vue", role: "page" },
      { id: "comp:src/lib/util.ts", role: "util" },
    ],
  };
  const seeded = seedFeatures(model);
  const names = seeded.map((f) => f.name).sort();
  assert.deepEqual(names, ["Home", "Vendors"], "pages become features, util does not");
  assert.equal(seeded.find((f) => f.name === "Home").status, "draft");
  assert.equal(seeded.find((f) => f.name === "Home").provenance[0].source, "code");
});

test("mergeFeatures: authored files win over seeds by id", () => {
  const seeded = [{ id: "feature:home", name: "Home", status: "draft", provenance: [{ source: "code" }] }];
  const authored = [{ id: "feature:home", name: "Home", description: "edited", provenance: [{ source: "human" }] }];
  const merged = mergeFeatures(authored, seeded);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].description, "edited");
  assert.equal(merged[0].provenance[0].source, "human");
});

test("readFeatures + seedFeatureFiles round-trip", () => {
  withRepo({ ".archmantic/features/home.md": FILE }, (dir) => {
    const read = readFeatures(dir);
    assert.equal(read.length, 1);
    assert.equal(read[0].name, "Home");

    // seedFeatureFiles writes only for features without a file.
    const model = {
      features: [
        { id: "feature:home", name: "Home", provenance: [{ source: "human" }] },
        { id: "feature:vendors", name: "Vendors", status: "draft", components: ["comp:x.vue"], provenance: [{ source: "code" }] },
      ],
    };
    const written = seedFeatureFiles(dir, model);
    assert.deepEqual(written, ["vendors"], "only the file-less feature is written");
    assert.ok(existsSync(join(dir, ".archmantic", "features", "vendors.md")));
  });
});
