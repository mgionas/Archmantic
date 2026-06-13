import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { Boxes, Workflow, ShieldCheck, GitCompareArrows, Bot, PencilRuler, ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listProjects, type ProjectRow } from "@/lib/store";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

const USPS = [
  { icon: Boxes, title: "Capability map", body: "Plain-English “what can this system do?” — for PMs, architects, and new hires, not just engineers." },
  { icon: Workflow, title: "BPMN business process", body: "Auto-detected business processes from code — white space no code-graph tool occupies." },
  { icon: ShieldCheck, title: "Provenance & trust", body: "Every element shows “grounded in N refs” + confidence. Verifiable, not plausible AI guesswork." },
  { icon: GitCompareArrows, title: "Drift & PR diffs", body: "“Your docs vs reality,” and how a PR reshapes the architecture — not a line diff." },
  { icon: Bot, title: "MCP for agents", body: "Your AI agent queries the same model — ~98% fewer tokens than reading files." },
  { icon: PencilRuler, title: "Edit-then-build", body: "Edit the diagram; it becomes the source. Emit a build spec for an agent to implement." },
];

const STEPS = [
  ["Analyze", "archmantic analyze — reverse-engineer a grounded model from any repo."],
  ["Connect", "Generate a CLI token here, then archmantic push to your org."],
  ["Share & build", "Your team and agents read the same model; edit the canvas, emit a build spec."],
];

function Landing() {
  return (
    <div className="relative isolate">
      {/* ambient gradient + dot grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.65_0.2_285/0.18),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(oklch(0.65_0.2_285/0.15)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]"
      />

      <section className="flex flex-col items-center pt-16 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <span className="size-1.5 rounded-full bg-primary" /> Living architecture · humans + agents
        </span>
        <h1 className="mt-6 max-w-4xl text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl">
          The architecture model your team and your{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            AI agents
          </span>{" "}
          actually trust.
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Point Archmantic at a repo → an accurate capability map, context &amp; sequence diagrams, and an auto-detected
          BPMN process. Every element grounded in code. Your agents query the same model over MCP.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <SignInButton>
            <Button size="lg" className="gap-2">
              Get started <ArrowRight className="size-4" />
            </Button>
          </SignInButton>
          <a href="https://github.com/mgionas/Archmantic" className={buttonVariants({ size: "lg", variant: "outline" })}>
            View on GitHub
          </a>
        </div>
        <code className="mt-8 rounded-lg border bg-card/60 px-4 py-2 font-mono text-sm text-muted-foreground backdrop-blur">
          <span className="text-primary">$</span> npx archmantic analyze && archmantic push
        </code>
      </section>

      <section className="mt-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USPS.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="group p-5 transition-colors hover:border-primary/40">
              <div className="mb-3 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon className="size-4.5" />
              </div>
              <div className="font-semibold">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-24">
        <h2 className="text-center text-2xl font-bold tracking-tight">From repo to shared model in three steps</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {STEPS.map(([title, body], i) => (
            <Card key={title} className="p-5">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary">
                {i + 1}
              </div>
              <div className="mt-3 font-semibold">{title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{body}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <SignInButton>
            <Button size="lg" className="gap-2">
              Start free <ArrowRight className="size-4" />
            </Button>
          </SignInButton>
        </div>
      </section>

      <footer className="mt-24 border-t pt-8 text-center text-sm text-muted-foreground">
        Archmantic — a living, trustworthy architecture model. ·{" "}
        <a href="https://github.com/mgionas/Archmantic" className="text-primary hover:underline">
          GitHub
        </a>
      </footer>
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
