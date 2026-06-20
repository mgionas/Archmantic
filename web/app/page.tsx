import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { Boxes, Workflow, ShieldCheck, GitCompareArrows, Bot, PencilRuler, ArrowRight, AlertCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { listProjects, type ProjectRow } from "@/lib/store";
import { ProjectsClient } from "./projects-client";

export const dynamic = "force-dynamic";

const USPS = [
  { icon: Boxes, title: "Capability map", body: "Plain-English “what can this system do?” — for PMs, architects, and new hires, not just engineers." },
  { icon: Workflow, title: "Business process", body: "Auto-detected business processes from code — white space no code-graph tool occupies." },
  { icon: ShieldCheck, title: "Provenance & trust", body: "Every element shows “grounded in N refs” + confidence. Verifiable, not plausible AI guesswork." },
  { icon: GitCompareArrows, title: "Drift & PR diffs", body: "“Your docs vs reality,” and how a PR reshapes the architecture — not a line diff." },
  { icon: Bot, title: "MCP for agents", body: "Your AI agent queries the same model — ~98% fewer tokens than reading files." },
  { icon: PencilRuler, title: "Edit-then-build", body: "Edit the diagram; it becomes the source. Emit a build spec for an agent to implement." },
];

const STEPS: [string, string, string][] = [
  ["Analyze", "archmantic analyze", "Reverse-engineer a grounded model from any repo."],
  ["Connect", "archmantic push", "Generate a CLI token here, then push to your org."],
  ["Share & build", "one model", "Your team and agents read the same model; emit a build spec."],
];

const STACKS: { name: string; slug: string }[] = [
  { name: "TypeScript", slug: "typescript" },
  { name: "JavaScript", slug: "javascript" },
  { name: "PHP", slug: "php" },
  { name: "Next.js", slug: "nextdotjs" },
  { name: "React", slug: "react" },
  { name: "Vue", slug: "vuedotjs" },
  { name: "NestJS", slug: "nestjs" },
  { name: "Express", slug: "express" },
  { name: "Laravel", slug: "laravel" },
  { name: "Inertia", slug: "inertia" },
  { name: "Livewire", slug: "livewire" },
  { name: "Prisma", slug: "prisma" },
  { name: "Drizzle", slug: "drizzle" },
  { name: "GraphQL", slug: "graphql" },
  { name: "PostgreSQL", slug: "postgresql" },
  { name: "MySQL", slug: "mysql" },
  { name: "SQLite", slug: "sqlite" },
];

/** A drafting "registration tick" eyebrow chip. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 border border-border bg-card/60 px-3 py-1 text-foreground/80">
      <span className="size-1.5 bg-primary" />
      <span className="bp-label text-[0.6rem]">{children}</span>
    </span>
  );
}

function StackStrip() {
  return (
    <section className="mt-28 text-center">
      <div className="bp-label text-muted-foreground">Detects your stack · TS/JS &amp; PHP · monorepos · APIs &amp; data models</div>
      <div className="mx-auto mt-8 grid max-w-3xl grid-cols-4 gap-px overflow-hidden border border-border bg-border sm:grid-cols-6 lg:grid-cols-9">
        {STACKS.map(({ name, slug }) => (
          <span
            key={slug}
            className="group flex flex-col items-center justify-center gap-2 bg-background py-5 transition-colors hover:bg-card"
            title={name}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://cdn.simpleicons.org/${slug}`}
              alt={name}
              width={26}
              height={26}
              loading="lazy"
              className="size-6 opacity-70 grayscale transition-all duration-200 group-hover:opacity-100 group-hover:grayscale-0"
            />
            <span className="text-[0.6rem] text-muted-foreground">{name}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

/** The signature visual: a drawing sheet — capability list + a context diagram on
 *  graph paper with cyan linework, amber nodes, mono labels, and a title block. */
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
        height={28}
        rx={2}
        className={primary ? "fill-[var(--amber)]/15 stroke-[var(--amber)]" : "fill-card stroke-[var(--blueprint)]"}
        strokeWidth={1.25}
      />
      <text
        x={x + w / 2}
        y={y + 18}
        textAnchor="middle"
        fontSize={9}
        fontFamily="var(--font-mono)"
        className={primary ? "fill-[var(--amber)]" : "fill-foreground"}
      >
        {label}
      </text>
    </g>
  );
  return (
    <div className="mt-16 w-full max-w-4xl">
      <div className="relative overflow-hidden border border-border bg-card shadow-2xl shadow-primary/10">
        {/* title bar */}
        <div className="flex items-center gap-2 border-b border-border bg-background/60 px-4 py-2.5">
          <span className="size-2 rounded-full bg-danger/70" />
          <span className="size-2 rounded-full bg-warning/70" />
          <span className="size-2 rounded-full bg-success/70" />
          <span className="ml-2 bp-label text-[0.6rem] text-muted-foreground">dwg · payments-api · context</span>
          <span className="ml-auto bp-label text-[0.55rem] text-muted-foreground/70">scale 1:1</span>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-[1fr_1.25fr]">
          <div className="space-y-2 bg-card p-5 text-left">
            <div className="bp-label text-[0.6rem] text-muted-foreground">Capability map</div>
            {caps.map(([n, b]) => (
              <div key={n} className="flex items-center justify-between border border-border bg-background/40 px-3 py-2 text-sm">
                <span>{n}</span>
                <span className={`bp-label text-[0.58rem] ${b === "high" ? "text-success" : "text-warning"}`}>
                  ● {b}
                </span>
              </div>
            ))}
          </div>
          <div className="bp-grid bg-canvas p-3">
            <div className="bp-label mb-1 text-[0.6rem] text-muted-foreground">Context</div>
            <svg viewBox="0 0 320 175" className="w-full">
              <defs>
                <marker id="bp-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6" className="fill-none stroke-[var(--blueprint)]" strokeWidth={1.2} />
                </marker>
              </defs>
              <g className="stroke-[var(--blueprint)]" strokeWidth={1.25} markerEnd="url(#bp-arrow)" fill="none">
                <line x1={62} y1={76} x2={126} y2={76} />
                <line x1={212} y1={76} x2={258} y2={33} />
                <line x1={212} y1={76} x2={258} y2={120} />
                <line x1={170} y1={90} x2={170} y2={132} />
              </g>
              <Node x={8} y={62} w={54} label="Gateway" />
              <Node x={128} y={62} w={82} label="payments-api" primary />
              <Node x={260} y={19} w={52} label="Stripe" />
              <Node x={260} y={106} w={52} label="Ledger" />
              <Node x={132} y={132} w={76} label="Webhooks" />
            </svg>
          </div>
        </div>
        {/* title block */}
        <div className="flex items-center justify-between border-t border-border bg-background/60 px-4 py-2">
          <span className="bp-label text-[0.55rem] text-muted-foreground/80">archmantic</span>
          <span className="bp-label text-[0.55rem] text-muted-foreground/60">sheet 01 · grounded in code</span>
        </div>
      </div>
    </div>
  );
}

function Landing() {
  return (
    <div className="relative isolate">
      <section className="flex flex-col items-center pt-16 text-center">
        <Eyebrow>humans + agents · one model</Eyebrow>
        <h1 className="mt-7 max-w-4xl text-balance text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
          The architecture model your team and your{" "}
          <span className="relative whitespace-nowrap text-primary">
            AI agents
            <span aria-hidden className="absolute -bottom-1 left-0 h-[3px] w-full bg-primary/70" />
          </span>{" "}
          actually trust.
        </h1>
        <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
          Point Archmantic at a repo → an accurate capability map, context &amp; sequence diagrams, an ERD, the API
          surface, and an auto-detected business process. Works across TS/JS &amp; PHP/Laravel and monorepos. Every
          element grounded in code. Your agents query the same model over MCP.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <SignInButton>
            <Button size="lg" className="gap-2 rounded-none">
              Get started <ArrowRight className="size-4" />
            </Button>
          </SignInButton>
          <a
            href="https://github.com/mgionas/Archmantic"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }), "rounded-none")}
          >
            View on GitHub
          </a>
        </div>
        <code className="mt-8 border border-border bg-card/70 px-4 py-2 font-mono text-sm text-muted-foreground backdrop-blur">
          <span className="text-primary">$</span> npx archmantic analyze &amp;&amp; archmantic push
        </code>
        <HeroPreview />
      </section>

      <section className="mt-28">
        <div className="bp-label mb-5 text-muted-foreground">// what you get</div>
        <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {USPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="group relative bg-card p-6 transition-colors hover:bg-accent/40">
              <div className="flex items-center justify-between">
                <span className="inline-flex size-9 items-center justify-center border border-primary/40 text-primary">
                  <Icon className="size-4.5" />
                </span>
                <span className="bp-label text-[0.6rem] text-muted-foreground/60">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="bp-title mt-4 text-[0.95rem]">{title}</div>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <StackStrip />

      <section className="mt-28">
        <div className="bp-label mb-5 text-center text-muted-foreground">// repo → shared model, in three steps</div>
        <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-3">
          {STEPS.map(([title, cmd, body], i) => (
            <div key={title} className="bg-card p-6">
              <div className="flex items-baseline gap-3">
                <span className="bp-title text-2xl text-primary">{String(i + 1).padStart(2, "0")}</span>
                <span className="bp-title text-[0.95rem]">{title}</span>
              </div>
              <code className="mt-3 block font-mono text-xs text-primary/90">{cmd}</code>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 flex justify-center">
          <SignInButton>
            <Button size="lg" className="gap-2 rounded-none">
              Start free <ArrowRight className="size-4" />
            </Button>
          </SignInButton>
        </div>
      </section>

      <footer className="mt-28 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-8">
        <span className="bp-label text-[0.6rem] text-muted-foreground">archmantic · living architecture</span>
        <span className="flex items-center gap-4">
          <Link href="/docs" className="bp-label text-[0.6rem] text-muted-foreground hover:text-primary">
            Docs
          </Link>
          <a
            href="https://github.com/mgionas/Archmantic"
            className="bp-label text-[0.6rem] text-muted-foreground hover:text-primary"
          >
            GitHub
          </a>
        </span>
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-start gap-3 rounded-none border-dashed p-8">
      <div className="bp-title text-lg">No projects in this organization yet</div>
      <p className="max-w-md text-sm text-muted-foreground">
        Generate a CLI token, add it to your repo&apos;s{" "}
        <code className="border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">.env.local</code>, and run{" "}
        <code className="border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">archmantic push</code>.
      </p>
      <Link href="/settings" className={cn(buttonVariants(), "mt-1 rounded-none")}>
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
          <div className="bp-label text-[0.6rem] text-muted-foreground">// organization</div>
          <h1 className="bp-title mt-1 text-2xl">Your projects</h1>
          <p className="text-sm text-muted-foreground">Shared architecture knowledge for your organization.</p>
        </div>
        <Link href="/settings" className={cn(buttonVariants({ variant: "outline" }), "rounded-none")}>
          Manage CLI tokens
        </Link>
      </div>

      {error ? (
        <Card className="flex items-start gap-3 rounded-none border-danger/40 bg-danger/5 p-6 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <div className="font-medium text-danger">Could not reach the store</div>
            <div className="mt-1 text-muted-foreground">{error}</div>
          </div>
        </Card>
      ) : projects.length === 0 ? (
        <EmptyState />
      ) : (
        <ProjectsClient projects={projects} />
      )}
    </div>
  );
}
