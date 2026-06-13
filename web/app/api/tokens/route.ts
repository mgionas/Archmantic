import { auth } from "@clerk/nextjs/server";
import { createToken } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Signed-in user (in their active org) mints a CLI token scoped to that org. */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const owner = orgId ?? userId;
  let label: string | null = null;
  try {
    label = ((await req.json()) as { label?: string }).label ?? null;
  } catch {
    /* no body is fine */
  }
  const token = await createToken(owner, label);
  return Response.json({ token, owner, scope: orgId ? "organization" : "personal" });
}
