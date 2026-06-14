// Laravel route detection (routes/*.php). Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectLaravelRoutes } from "../dist/analyze/laravel.js";

function withRepo(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), "archmantic-lar-"));
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

const find = (eps, method, path) => eps.find((e) => e.method === method && e.path === path);

test("verb routes, params, and api.php /api prefix", () => {
  withRepo(
    {
      "routes/web.php": "<?php\nRoute::get('/', fn() => 1);\nRoute::post('verify', 'C@verify');\nRoute::get('send/{phone}', 'C@send');",
      "routes/api.php": "<?php\nRoute::get('user', 'C@me');\nRoute::delete('posts/{post?}', 'C@del');",
    },
    (dir) => {
      const eps = detectLaravelRoutes(dir);
      assert.ok(find(eps, "GET", "/"), "root route");
      assert.ok(find(eps, "POST", "/verify"));
      assert.ok(find(eps, "GET", "/send/:phone"), "{phone} → :phone");
      assert.ok(find(eps, "GET", "/api/user"), "api.php gets /api prefix");
      assert.ok(find(eps, "DELETE", "/api/posts/:post"), "{post?} → :post under /api");
    },
  );
});

test("nested prefix groups (both syntaxes)", () => {
  withRepo(
    {
      "routes/web.php": [
        "<?php",
        "Route::prefix('admin')->group(function () {",
        "  Route::get('dashboard', 'C@dash');",
        "  Route::prefix('reports')->middleware('auth')->group(function () {",
        "    Route::get('daily', 'C@daily');",
        "  });",
        "});",
        "Route::group(['prefix' => 'v2', 'middleware' => 'auth'], function () {",
        "  Route::post('sync', 'C@sync');",
        "});",
      ].join("\n"),
    },
    (dir) => {
      const eps = detectLaravelRoutes(dir);
      assert.ok(find(eps, "GET", "/admin/dashboard"), "single prefix group");
      assert.ok(find(eps, "GET", "/admin/reports/daily"), "nested prefix groups compose");
      assert.ok(find(eps, "POST", "/v2/sync"), "array-syntax group prefix");
    },
  );
});

test("resource and apiResource expansion", () => {
  withRepo(
    {
      "routes/web.php": "<?php\nRoute::resource('photos', 'PhotoController');\nRoute::apiResource('books', 'BookController');",
    },
    (dir) => {
      const eps = detectLaravelRoutes(dir);
      // apiResource → 5 RESTful routes (no create/edit).
      assert.ok(find(eps, "GET", "/books"));
      assert.ok(find(eps, "POST", "/books"));
      assert.ok(find(eps, "GET", "/books/:id"));
      assert.ok(find(eps, "PUT", "/books/:id"));
      assert.ok(find(eps, "DELETE", "/books/:id"));
      assert.equal(find(eps, "GET", "/books/create"), undefined, "apiResource has no create page");
      // resource → adds create + edit pages.
      assert.ok(find(eps, "GET", "/photos/create"));
      assert.ok(find(eps, "GET", "/photos/:id/edit"));
    },
  );
});

test("Route::match maps to each listed verb", () => {
  withRepo(
    { "routes/web.php": "<?php\nRoute::match(['get', 'post'], 'search', 'C@search');" },
    (dir) => {
      const eps = detectLaravelRoutes(dir);
      assert.ok(find(eps, "GET", "/search"));
      assert.ok(find(eps, "POST", "/search"));
    },
  );
});

test("vendor/ and non-routes php are ignored", () => {
  withRepo(
    {
      "routes/web.php": "<?php\nRoute::get('ok', 'C@ok');",
      "vendor/laravel/framework/routes/web.php": "<?php\nRoute::get('framework-internal', 'X@y');",
      "app/Http/Controllers/C.php": "<?php\nRoute::get('not-a-route-file', 'X@y');",
    },
    (dir) => {
      const eps = detectLaravelRoutes(dir);
      assert.ok(find(eps, "GET", "/ok"));
      assert.equal(find(eps, "GET", "/framework-internal"), undefined, "vendor/ excluded");
      assert.equal(find(eps, "GET", "/not-a-route-file"), undefined, "non routes/ php ignored");
    },
  );
});
