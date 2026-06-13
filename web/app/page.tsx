import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listProjects, type ProjectRow } from "@/lib/store";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

const USPS: [string, string][] = [
  ["Capability map", "Plain-English “what can this system do?” — for PMs, architects, and new hires, not just engineers."],
  ["BPMN business process", "Auto-detected business processes from code — white space no code-graph tool occupies."],
  ["Provenance & trust", "Every element shows “grounded in N refs” + confidence. Verifiable, not plausible AI guesswork."],
  ["Drift & PR diffs", "“Your docs vs reality,” and how a PR reshapes the architecture — not a line diff."],
  ["MCP for agents", "Your AI agent queries the same model — ~98% fewer tokens than reading files."],
  ["Edit-then-build", "Edit the diagram; it becomes the source. Emit a build spec for an agent to implement."],
];

function Landing() {
  return (
    <div className="flex flex-col gap-12">
      <section className="pt-6">
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          A living, <span className="text-primary">trustworthy</span> architecture model your team and your AI agents
          share.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Point Archmantic at a repo → an accurate capability map, context &amp; sequence diagrams, and an auto-detected
          BPMN process — every element grounded in code. Your agents query the same model over MCP.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <SignInButton>
            <Button size="lg">Sign in / Get started</Button>
          </SignInButton>
          <a
            href="https://github.com/mgionas/Archmantic"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            View on GitHub
          </a>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">What you get</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USPS.map(([title, body]) => (
            <Card key={title} className="p-5">
              <div className="mb-1.5 font-semibold">{title}</div>
              <p className="text-sm text-muted-foreground">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Get started</h2>
        <Card className="p-6">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            <li>
              Analyze your repo: <code className="rounded bg-muted px-1.5 py-0.5">npm i -g archmantic</code> →{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">archmantic analyze</code>.
            </li>
            <li>Sign in here, open <strong>CLI tokens</strong>, and generate a token for your organization.</li>
            <li>
              Add <code className="rounded bg-muted px-1.5 py-0.5">ARCHMANTIC_TOKEN</code> +{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">ARCHMANTIC_API_URL</code> to{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code>, then{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">archmantic push</code>.
            </li>
            <li>Your model appears here — capability map, diagrams, trust, and an editable BPMN canvas.</li>
          </ol>
        </Card>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-start gap-3 p-8">
      <div className="text-lg font-semibold">No projects in this organization yet</div>
      <p className="max-w-md text-sm text-muted-foreground">
        Generate a CLI token, add it to your repo&apos;s <code className="rounded bg-muted px-1.5 py-0.5">.env.local</code>,
        and run <code className="rounded bg-muted px-1.5 py-0.5">archmantic push</code>.
      </p>
      <Link href="/settings" className={cn(buttonVariants(), "mt-1")}>
        Get a CLI token →
      </Link>
    </Card>
  );
}

export default async function Home() {
  const { userId, orgId } = await auth().catch(() => ({ userId: null, orgId: null }));
  if (!userId) return <Landing />;

  const owner = orgId ?? userId;
  let projects: ProjectRow[] = [];
  let error: string | null = null;
  try {
    if (owner) projects = await listProjects(owner);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your projects</h1>
          <p className="text-sm text-muted-foreground">Shared architecture knowledge for your organization.</p>
        </div>
        <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
          Manage CLI tokens
        </Link>
      </div>

      {error ? (
        <Card className="p-6 text-sm text-muted-foreground">Could not reach the store: {error}</Card>
      ) : projects.length === 0 ? (
        <EmptyState />
      ) : (
        <ProjectsClient projects={projects} />
      )}
    </div>
  );
}
