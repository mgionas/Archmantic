// Component role classifier. Runs against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyRole, refineRole } from "../dist/analyze/roles.js";

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

test("content signals refine weak path roles", () => {
  // A route handler not under route.ts → upgraded to route.
  assert.equal(refineRole("src/api/users.ts", "import { NextResponse } from 'next/server'", "module"), "route");
  // A component outside components/ that returns JSX → ui.
  assert.equal(refineRole("src/widgets/Card.tsx", "export default function Card(){ return (<div/>) }", "ui"), "ui");
  assert.equal(refineRole("src/Thing.tsx", "export function Thing(){ return (<span/>) }", "module"), "ui");
  // A hook not named use* by file → upgraded from content.
  assert.equal(refineRole("src/lib/auth.ts", "export function useAuth(){}", "service"), "hook");
  // A store via createContext.
  assert.equal(refineRole("src/x.ts", "export const Ctx = createContext(null)", "module"), "store");
  // Strong path roles are never overridden by content.
  assert.equal(refineRole("app/api/route.ts", "return (<div/>)", "route"), "route");
  // No signal → keep the path role.
  assert.equal(refineRole("src/util/x.ts", "export const x = 1", "util"), "util");
});
