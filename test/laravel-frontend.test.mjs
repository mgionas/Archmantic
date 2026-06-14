// Vue SFC walking + Inertia/Blade/Livewire roles. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeRepo } from "../dist/analyze/index.js";
import { classifyRole } from "../dist/analyze/roles.js";
import { detectLaravelViews } from "../dist/analyze/laravel-views.js";

function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-lfe-"));
  try {
    writeFileSync(join(dir, "package.json"), '{ "name": "app" }');
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

test("Inertia/Blade/Livewire path roles", () => {
  assert.equal(classifyRole("resources/js/Pages/Admin/Game/index.vue"), "page");
  assert.equal(classifyRole("resources/js/pages/auth/login.tsx"), "page");
  assert.equal(classifyRole("resources/js/Layouts/AppLayout.vue"), "layout");
  assert.equal(classifyRole("resources/js/Components/Button.vue"), "ui");
  assert.equal(classifyRole("resources/views/dashboard.blade.php"), "view");
  assert.equal(classifyRole("resources/views/layouts/app.blade.php"), "layout");
  assert.equal(classifyRole("resources/views/components/alert.blade.php"), "ui");
});

test("Vue SFCs are walked as components and their imports resolve", () => {
  withRepo(
    {
      "resources/js/Pages/Home.vue": "<template><Card/></template>\n<script setup lang='ts'>\nimport Card from '../Components/Card.vue';\n</script>",
      "resources/js/Components/Card.vue": "<template><div/></template>\n<script setup></script>",
    },
    (dir) => {
      const m = analyzeRepo(dir);
      const home = m.components.find((c) => c.id.endsWith("Pages/Home.vue"));
      const card = m.components.find((c) => c.id.endsWith("Components/Card.vue"));
      assert.ok(home && card, "both .vue files become components");
      assert.equal(home.role, "page");
      assert.equal(card.role, "ui");
      assert.ok(
        m.relations.some((r) => r.from === home.id && r.to === card.id),
        "Vue <script> import edge resolves Home → Card",
      );
    },
  );
});

test("Blade views and Livewire classes become components", () => {
  withRepo(
    {
      "resources/views/dashboard.blade.php": "<x-app><h1>Hi</h1></x-app>",
      "resources/views/layouts/app.blade.php": "<html>{{ $slot }}</html>",
      "app/Livewire/Counter.php": "<?php\nclass Counter extends Component {}",
    },
    (dir) => {
      const comps = detectLaravelViews(dir);
      const byId = (suffix) => comps.find((c) => c.id.endsWith(suffix));
      assert.equal(byId("views/dashboard.blade.php").role, "view");
      assert.equal(byId("layouts/app.blade.php").role, "layout");
      assert.equal(byId("Livewire/Counter.php").role, "ui");
    },
  );
});
