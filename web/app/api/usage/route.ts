import { ownerForToken, recordUsageForOwner, type UsageEvent } from "@/lib/admin";

export const dynamic = "force-dynamic";

function bearer(req: Request): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
}

/** CLI/MCP usage record: Bearer <org token> → append events under that org. */
export async function POST(req: Request) {
  const owner = await ownerForToken(bearer(req));
  if (!owner) return new Response("Invalid or missing token", { status: 401 });

  let body: { events?: UsageEvent[] };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!Array.isArray(body.events)) return new Response("Body must include { events }", { status: 400 });

  await recordUsageForOwner(owner, body.events);
  return Response.json({ ok: true, recorded: body.events.length });
}
