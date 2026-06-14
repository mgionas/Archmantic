/**
 * Laravel server-side UI → components: Blade templates and Livewire classes.
 *
 * The JS walker only sees the Inertia/SPA frontend. Traditional Laravel renders
 * UI from Blade views (`resources/views/**\/*.blade.php`) and Livewire components
 * (`app/Livewire/**`, `app/Http/Livewire/**`). These become Components so the
 * architecture model covers blade/livewire apps too, not just Inertia ones.
 * Role comes from the path classifier (view/layout/ui). Grounded to file:1.
 */
import { relative } from "node:path";
import { type Component } from "../ir/types.js";
import { STRUCTURAL_CONFIDENCE } from "./tier0.js";
import { findFiles, isTestFile } from "./fs-util.js";
import { classifyRole } from "./roles.js";

const BLADE_FILE = /(^|\/)resources\/views\/.+\.blade\.php$/;
const LIVEWIRE_FILE = /(^|\/)app\/(Http\/)?Livewire\/.+\.php$/;

export function detectLaravelViews(root: string): Component[] {
  const out: Component[] = [];
  const seen = new Set<string>();
  const push = (rel: string, role: string) => {
    const id = `comp:${rel}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      name: rel,
      kind: "module",
      role,
      provenance: [{ source: "code", ref: `${rel}:1`, confidence: STRUCTURAL_CONFIDENCE }],
      confidence: STRUCTURAL_CONFIDENCE,
    });
  };

  for (const abs of findFiles(root, (n) => n.endsWith(".php"))) {
    const rel = relative(root, abs).split("\\").join("/");
    if (isTestFile(rel)) continue;
    if (BLADE_FILE.test(rel)) push(rel, classifyRole(rel)); // → view / layout / ui
    else if (LIVEWIRE_FILE.test(rel)) push(rel, "ui"); // Livewire component class
  }
  return out;
}
