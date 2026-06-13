import { ownerForToken, getProcessEdit } from "@/lib/admin";

export const dynamic = "force-dynamic";

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

/** CLI fetches the org's human-edited BPMN to merge into the IR (edit-then-build). */
export async function GET(req: Request) {
  const owner = await ownerForToken(bearer(req));
  if (!owner) return new Response("Invalid or missing token", { status: 401 });
  const project = new URL(req.url).searchParams.get("project");
  if (!project) return new Response("Missing ?project=", { status: 400 });
  const xml = await getProcessEdit(owner, project);
  if (!xml) return new Response("No saved edit", { status: 404 });
  return Response.json({ xml });
}
