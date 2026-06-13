import { ownerForToken, pushModelApi } from "@/lib/admin";

export const dynamic = "force-dynamic";

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

/** CLI managed-SaaS push: Bearer <org token> → upsert the model under that org. */
export async function POST(req: Request) {
  const owner = await ownerForToken(bearer(req));
  if (!owner) return new Response("Invalid or missing token", { status: 401 });

  let body: { model?: { project?: string }; commit?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!body.model?.project) return new Response("Body must include { model, commit }", { status: 400 });

  await pushModelApi(owner, body.model as never, body.commit ?? "working-tree");
  return Response.json({ ok: true });
}
