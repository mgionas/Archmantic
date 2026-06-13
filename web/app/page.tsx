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

function HeroPreview() {
  const caps: [string, "high" | "medium"][] = [
    ["Charge a card", "high"],
    ["Refund payment", "high"],
    ["Dispatch webhook", "medium"],
    ["Reconcile ledger", "medium"],
  ];
  const Node = ({ x, y, w, label, primary }: { x: number; y: number; w: number; label: string; primary?: boolean }) => (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={26}
        rx={6}
        className={primary ? "fill-primary stroke-primary" : "fill-card stroke-border"}
      />
      <text
        x={x + w / 2}
        y={y + 17}
        textAnchor="middle"
        fontSize={9}
        className={primary ? "fill-primary-foreground" : "fill-foreground"}
      >
        {label}
      </text>
    </g>
  );
  return (
    <div className="mt-14 w-full max-w-4xl">
      <div className="overflow-hidden rounded-xl border bg-card shadow-2xl shadow-primary/10">
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-green-400/70" />
          <span className="ml-3 font-mono text-xs text-muted-foreground">archmantic · payments-api</span>
        </div>
        <div className="grid gap-4 p-5 text-left sm:grid-cols-[1fr_1.2fr]">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Capability map</div>
            {caps.map(([n, b]) => (
              <div
                key={n}
                className="flex items-center justify-between rounded-md border bg-background/50 px-3 py-2 text-sm"
              >
                <span>{n}</span>
                <span className={`text-xs ${b === "high" ? "text-green-400" : "text-amber-400"}`}>● {b}</span>
              </div>
            ))}
          </div>
          <div className="rounded-md border bg-background/50 p-3">
            <div className="mb-1 text-xs font-medium text-muted-foreground">Context</div>
            <svg viewBox="0 0 320 170" className="w-full">
              <g className="stroke-border" strokeWidth={1.5}>
                <line x1={60} y1={75} x2={130} y2={75} />
                <line x1={210} y1={75} x2={262} y2={30} />
                <line x1={210} y1={75} x2={262} y2={120} />
                <line x1={170} y1={88} x2={170} y2={135} />
              </g>
              <Node x={8} y={62} w={52} label="Gateway" />
              <Node x={130} y={62} w={80} label="payments-api" primary />
              <Node x={262} y={17} w={50} label="Stripe" />
              <Node x={262} y={107} w={50} label="Ledger" />
              <Node x={132} y={135} w={76} label="Webhooks" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

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
          <span className="text-primary">$</span> npx @archmantic/cli analyze && archmantic push
        </code>
        <HeroPreview />
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
        <Link href="/docs" className="text-primary hover:underline">
          Docs
        </Link>{" "}
        ·{" "}
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
        <div className="flex gap-2">
          <Link href="/systems" className={buttonVariants({ variant: "outline" })}>
            Systems
          </Link>
          <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
            Manage CLI tokens
          </Link>
        </div>
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
