// Local feature editor — write-back round-trip. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeFeatureEdit } from "../dist/editor.js";
import { readFeatures } from "../dist/project/features.js";

function withRepo(fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-ed-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("writeFeatureEdit writes a file readFeatures parses back", () => {
  withRepo((dir) => {
    const slug = writeFeatureEdit(dir, {
      name: "Home",
      status: "active",
      description: "The landing page.",
      shows: ["hero slider (from admin)", "vendors section", ""],
      actions: ["browse vendors — opens the listing", "search"],
      dependsOn: ["Login", " Vendors "],
      components: ["resources/js/Pages/Home.vue"],
    });
    assert.equal(slug, "home");
    assert.ok(existsSync(join(dir, ".archmantic", "features", "home.md")));

    const [f] = readFeatures(dir);
    assert.equal(f.name, "Home");
    assert.equal(f.status, "active");
    assert.equal(f.description, "The landing page.");
    assert.deepEqual(f.shows[0], { text: "hero slider", source: "admin" });
    assert.equal(f.shows.length, 2, "empty line dropped");
    assert.deepEqual(f.actions[0], { name: "browse vendors", description: "opens the listing" });
    assert.deepEqual(f.dependsOn, ["feature:login", "feature:vendors"]);
    assert.deepEqual(f.components, ["comp:resources/js/Pages/Home.vue"]);
    assert.equal(f.provenance[0].source, "human");
  });
});

test("name drives the slug/filename", () => {
  withRepo((dir) => {
    const slug = writeFeatureEdit(dir, { name: "Vendor Profile", description: "x" });
    assert.equal(slug, "vendor-profile");
    assert.ok(existsSync(join(dir, ".archmantic", "features", "vendor-profile.md")));
  });
});
