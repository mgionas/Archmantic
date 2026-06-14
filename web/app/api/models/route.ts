import { ownerForToken } from "@/lib/admin";
import { latestModelsForOwner } from "@/lib/store";

export const dynamic = "force-dynamic";

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

/** CLI/MCP: Bearer <org token> → the org's latest model per project (for suggest_links). */
export async function GET(req: Request) {
  const owner = await ownerForToken(bearer(req));
  if (!owner) return new Response("Invalid or missing token", { status: 401 });
  const models = await latestModelsForOwner(owner);
  return Response.json({ models });
}
