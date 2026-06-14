// Component role classifier. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRole } from "../dist/analyze/roles.js";

test("classifies components by semantic role from path", () => {
  const cases = {
    "app/api/users/route.ts": "route",
    "pages/api/login.ts": "route",
    "app/dashboard/page.tsx": "page",
    "app/layout.tsx": "layout",
    "middleware.ts": "middleware",
    "next.config.ts": "config",
    "src/hooks/useUser.ts": "hook",
    "components/useToggle.ts": "hook",
    "src/store/cart.ts": "store",
    "src/state/auth.context.ts": "store",
    "prisma/schema.prisma": "model",
    "src/models/user.ts": "model",
    "components/ConfirmModal.tsx": "modal",
    "components/Button.tsx": "ui",
    "src/services/payments.ts": "service",
    "src/lib/db.ts": "service",
    "src/utils/format.ts": "util",
    "src/index.ts": "module",
  };
  for (const [path, expected] of Object.entries(cases)) {
    assert.equal(classifyRole(path), expected, `${path} → ${expected}`);
  }
});
