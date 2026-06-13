import { ownerForToken, pullLatestForOwner } from "@/lib/admin";

export const dynamic = "force-dynamic";

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

/** CLI managed-SaaS pull: Bearer <org token> → latest model for ?project= in that org. */
export async function GET(req: Request) {
  const owner = await ownerForToken(bearer(req));
  if (!owner) return new Response("Invalid or missing token", { status: 401 });

  const project = new URL(req.url).searchParams.get("project");
  if (!project) return new Response("Missing ?project=", { status: 400 });

  const model = await pullLatestForOwner(owner, project);
  if (!model) return new Response("Not found", { status: 404 });
  return Response.json({ model });
}
