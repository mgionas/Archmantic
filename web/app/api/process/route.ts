import { auth } from "@clerk/nextjs/server";
import { saveProcessEdit } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** Save a human-edited BPMN diagram for the signed-in user's active org. */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const owner = orgId ?? userId;

  let body: { project?: string; xml?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!body.project || !body.xml) return new Response("Body must include { project, xml }", { status: 400 });

  await saveProcessEdit(owner, body.project, body.xml);
  return Response.json({ ok: true });
}
