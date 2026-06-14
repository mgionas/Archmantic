import { ownerForToken, listFeatureEdits } from "@/lib/admin";

export const dynamic = "force-dynamic";

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

/** CLI/MCP fetches the org's pending feature edits to write into .archmantic/features/. */
export async function GET(req: Request) {
  const owner = await ownerForToken(bearer(req));
  if (!owner) return new Response("Invalid or missing token", { status: 401 });
  const project = new URL(req.url).searchParams.get("project");
  if (!project) return new Response("Missing ?project=", { status: 400 });
  const edits = await listFeatureEdits(owner, project);
  return Response.json({ edits });
}
