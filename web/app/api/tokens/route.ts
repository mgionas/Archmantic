import { auth } from "@clerk/nextjs/server";
import { createToken, listTokens, renameToken, deleteToken } from "@/lib/admin";

export const dynamic = "force-dynamic";

async function owner(): Promise<string | null> {
  const { userId, orgId } = await auth();
  if (!userId) return null;
  return orgId ?? userId;
}

/** List the active org/user's tokens (masked). */
export async function GET() {
  const o = await owner();
  if (!o) return new Response("Unauthorized", { status: 401 });
  return Response.json({ tokens: await listTokens(o), scope: o.startsWith("org_") ? "organization" : "personal" });
}

/** Mint a new token (returned once). */
export async function POST(req: Request) {
  const o = await owner();
  if (!o) return new Response("Unauthorized", { status: 401 });
  let label: string | null = null;
  try {
    label = ((await req.json()) as { label?: string }).label ?? null;
  } catch {
    /* no body is fine */
  }
  const token = await createToken(o, label);
  return Response.json({ token, scope: o.startsWith("org_") ? "organization" : "personal", owner: o });
}

/** Rename a token's label. */
export async function PATCH(req: Request) {
  const o = await owner();
  if (!o) return new Response("Unauthorized", { status: 401 });
  const { id, label } = (await req.json()) as { id?: string; label?: string };
  if (!id) return new Response("Missing id", { status: 400 });
  await renameToken(o, id, label ?? "");
  return Response.json({ ok: true });
}

/** Revoke a token. */
export async function DELETE(req: Request) {
  const o = await owner();
  if (!o) return new Response("Unauthorized", { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });
  await deleteToken(o, id);
  return Response.json({ ok: true });
}
