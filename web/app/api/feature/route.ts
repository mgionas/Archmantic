import { auth } from "@clerk/nextjs/server";
import { saveFeatureEdit, type FeatureEditPayload } from "@/lib/admin";

export const dynamic = "force-dynamic";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "feature";

/** Save a hosted-editor feature edit for the signed-in user's active org. */
export async function POST(req: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });
  const owner = orgId ?? userId;

  let body: ({ project?: string } & Partial<FeatureEditPayload>) | null;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!body?.project || !body.name) return new Response("Body must include { project, name }", { status: 400 });

  const payload: FeatureEditPayload = {
    slug: body.slug?.trim() || slugify(body.name),
    name: body.name,
    description: body.description,
    shows: body.shows,
    actions: body.actions,
    dependsOn: body.dependsOn,
    components: body.components,
    status: body.status,
  };
  await saveFeatureEdit(owner, body.project, payload);
  return Response.json({ ok: true, slug: payload.slug });
}
