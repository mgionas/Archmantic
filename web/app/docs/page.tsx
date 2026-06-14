import Link from "next/link";
import type { ReactNode } from "react";

export const metadata = {
  title: "Docs — Archmantic",
  description: "Install, quickstart, CLI reference, MCP setup, supported frameworks (TS/JS & PHP/Laravel), monorepos, multi-repo systems, and the edit-then-build loop.",
};

const NAV: { id: string; label: string }[] = [
  { id: "about", label: "What is Archmantic" },
  { id: "frameworks", label: "Frameworks & languages" },
  { id: "install", label: "Install" },
  { id: "quickstart", label: "Quickstart" },
  { id: "cloud", label: "Connect a team" },
  { id: "cli", label: "CLI reference" },
  { id: "mcp", label: "MCP for agents" },
  { id: "monorepo", label: "Monorepos" },
  { id: "multirepo", label: "Multi-repo systems" },
  { id: "ci", label: "CI / PR diffs" },
  { id: "edit-build", label: "Edit-then-build" },
];

function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border/60 bg-card/60 p-4 text-sm leading-relaxed">
      <code className="font-mono text-foreground">{children}</code>
    </pre>
  );
}

function Inline({ children }: { children: ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border/40 pb-10">
      <h2 className="mb-4 text-xl font-bold tracking-tight">
        <a href={`#${id}`} className="group">
          {title}
          <span className="ml-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">#</span>
        </a>
      </h2>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground [&_a]:text-primary [&_a:hover]:underline [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

const COMMANDS: [string, string][] = [
  ["init [name]", "Create an empty .archmantic/model.json (+ a project.json brain)"],
  ["project [--init]", "Scaffold/show the project brain (goal, author, links; agents auto-detect from .claude/agents/)"],
  ["feature [list|show|seed|sync]", "Features; seed writes draft .md files; sync = BYOK intent compiler (description → create/update features)"],
  ["edit [--port N]", "Local web feature editor; saves write .archmantic/features/*.md (repo files = source)"],
  ["feature pull", "Fetch hosted-editor feature edits from the cloud → .archmantic/features/*.md"],
  ["analyze [--tier N]", "Reverse-engineer the model. --tier 2 adds the LLM semantic pass (BYOK)"],
  ["update [--hook]", "Incrementally re-analyze only what changed (git-diff driven). --hook prints a pre-commit hook"],
  ["view", "Capability map, diagrams, and trust report → a self-contained view.html"],
  ["spec", "Emit an agent-ready build spec (build-spec.md + .json) from the model"],
  ["knowledge", "Refresh AGENTS.md agent-context file (managed block; auto on analyze/update)"],
  ["apply [--from f]", "Merge a human BPMN canvas edit back into the model — the “edit” of edit-then-build"],
  ["handoff [--apply]", "Run the build spec through Claude → a plan; --apply runs an autonomous agent that edits the repo and self-verifies"],
  ["drift [--check]", "Compare the committed model vs. the code; --check exits 1 on drift (CI gate)"],
  ["diff [<ref>]", "Architecture diff from a git ref → working tree; writes PR-comment-ready pr-diff.md"],
  ["log [-n N]", "Architecture history: how the architecture changed per commit"],
  ["system [name]", "Unified cross-service view across repos (declare links in .archmantic/config.json)"],
  ["push / pull", "Sync the model to/from the Archmantic cloud (token or DATABASE_URL)"],
  ["usage [--sync]", "MCP usage + token savings; --sync pushes the local log to the cloud /usage dashboard"],
  ["mcp", "Start the MCP server exposing the model to AI agents (stdio)"],
  ["bench [--exact]", "Token-savings benchmark; --exact uses the Anthropic token counter (BYOK)"],
];

export default function Docs() {
  return (
    <div className="grid gap-10 lg:grid-cols-[200px_1fr]">
      <aside className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
        <nav className="space-y-1 text-sm">
          <div className="mb-2 font-semibold text-foreground">On this page</div>
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className="block rounded px-2 py-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {n.label}
            </a>
          ))}
        </nav>
      </aside>

      <article className="min-w-0 max-w-3xl space-y-10">
        <header>
          <h1 className="text-3xl font-bold tracking-tight">Documentation</h1>
          <p className="mt-2 text-muted-foreground">
            Archmantic turns any repo into a living, provenance-grounded architecture model — visual diagrams for
            humans, an MCP surface for agents.
          </p>
        </header>

        <Section id="about" title="What is Archmantic">
          <p>
            Point Archmantic at a repo and it reverse-engineers a single <strong>architecture model</strong> (the IR).
            Every diagram — C4-style context, components, sequence (interactive graphs), an auto-detected BPMN business process, and
            an ERD of your data model (from Prisma, Drizzle, SQL, or <strong>Laravel migrations</strong>), plus a detected
            API surface (REST/tRPC/GraphQL, incl. <strong>NestJS</strong> and <strong>Laravel</strong> routes) — is a{" "}
            <strong>projection</strong> of that one model. Every element is traceable to <Inline>file:line</Inline> with a
            confidence band, so it&apos;s verifiable, not plausible AI guesswork.
          </p>
          <p>
            The same model answers your AI agent&apos;s questions over <strong>MCP</strong>, so the agent reads the model
            instead of whole files (~98% fewer tokens on this repo, by the built-in benchmark).
          </p>
        </Section>

        <Section id="frameworks" title="Frameworks & languages">
          <p>Archmantic is polyglot — it detects, per layer:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Languages</strong> — TypeScript / JavaScript and <strong>PHP</strong>.
            </li>
            <li>
              <strong>Frontend / components</strong> — React &amp; <strong>Vue</strong> (<Inline>.vue</Inline> SFCs),
              including Inertia <Inline>resources/js/Pages</Inline>, plus <strong>Blade</strong> templates and{" "}
              <strong>Livewire</strong> components. Each is role-classified (page, route, ui, layout, view, model, hook,
              store, …).
            </li>
            <li>
              <strong>API surface</strong> — Next.js (App Router &amp; Pages), Express / Fastify / Koa / Hono,{" "}
              <strong>NestJS</strong> decorators, <strong>Laravel</strong> <Inline>routes/*.php</Inline> (prefix groups +{" "}
              <Inline>resource</Inline>/<Inline>apiResource</Inline>), tRPC, and GraphQL.
            </li>
            <li>
              <strong>Data model (ERD)</strong> — Prisma, Drizzle, SQL <Inline>CREATE TABLE</Inline>, and Laravel
              migrations (<Inline>Schema::create</Inline> + foreign keys). Framework scaffolding tables are filtered out.
            </li>
            <li>
              <strong>Tech stack</strong> — detected from <Inline>package.json</Inline> and <Inline>composer.json</Inline>{" "}
              (Laravel, Inertia, Livewire, Sanctum, …).
            </li>
          </ul>
        </Section>

        <Section id="install" title="Install">
          <p>No install needed — run it straight from npm:</p>
          <Code>{`npx archmantic analyze
npx archmantic view`}</Code>
          <p>Or install the CLI globally:</p>
          <Code>{`npm install -g archmantic
archmantic analyze`}</Code>
          <p>
            Requires <strong>Node 24+</strong>. The core CLI is Apache-2.0 and dependency-light.
          </p>
        </Section>

        <Section id="quickstart" title="Quickstart">
          <p>From the root of any repo:</p>
          <Code>{`npx archmantic analyze   # → .archmantic/model.json  (the model)
npx archmantic view      # → .archmantic/view.html   (diagrams + trust report)
npx archmantic bench     # token savings: MCP vs raw file reads`}</Code>
          <p>
            <Inline>analyze</Inline> runs cheapest-first: repo structure, then a static import graph (TypeScript compiler
            API), then structural capabilities and a process flow. Add <Inline>--tier 2</Inline> for the optional LLM
            semantic pass (bring your own Anthropic key).
          </p>
        </Section>

        <Section id="cloud" title="Connect a team">
          <p>
            Share one model across your team and agents. Generate a CLI token on the{" "}
            <Link href="/settings">tokens page</Link>, add it to your repo&apos;s <Inline>.env.local</Inline>, then push:
          </p>
          <Code>{`# .env.local
ARCHMANTIC_TOKEN=am_xxx

npx archmantic push      # upload the model to your org
npx archmantic pull      # fetch the latest team model`}</Code>
          <p>
            Each push is stored per commit, so you get an <strong>architecture history</strong> and per-PR diffs. Your
            teammates and agents read the same model in this web app.
          </p>
        </Section>

        <Section id="cli" title="CLI reference">
          <div className="overflow-hidden rounded-lg border border-border/60">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-foreground">
                <tr>
                  <th className="px-4 py-2 font-semibold">Command</th>
                  <th className="px-4 py-2 font-semibold">What it does</th>
                </tr>
              </thead>
              <tbody>
                {COMMANDS.map(([cmd, desc]) => (
                  <tr key={cmd} className="border-t border-border/40 align-top">
                    <td className="whitespace-nowrap px-4 py-2">
                      <Inline>{cmd}</Inline>
                    </td>
                    <td className="px-4 py-2">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="mcp" title="MCP for agents">
          <p>
            Expose the model to any MCP-compatible agent (Claude Code, Claude Desktop, Cursor, …). First build the model
            once, then register the server with your agent — you don&apos;t run it by hand.
          </p>
          <Code>{`archmantic analyze        # build .archmantic/model.json (once)`}</Code>
          <p>
            <strong>Claude Code</strong> — register it from the project directory:
          </p>
          <Code>{`claude mcp add archmantic -- npx archmantic mcp`}</Code>
          <p>
            <strong>Claude Desktop / Cursor</strong> — add it to the client&apos;s <Inline>mcpServers</Inline> config:
          </p>
          <Code>{`{
  "mcpServers": {
    "archmantic": {
      "command": "npx",
      "args": ["archmantic", "mcp"]
    }
  }
}`}</Code>
          <p>
            <strong>It&apos;s a long-running stdio server.</strong> Your agent launches it on demand, talks to it over
            stdin/stdout, and shuts it down afterward — so it stays running while connected (that&apos;s by design, not a
            hung process). You normally never run <Inline>archmantic mcp</Inline> yourself; if you do, it prints a notice
            and waits — press <Inline>Ctrl-C</Inline> to stop.
          </p>
          <p>
            Once connected, the agent reads the <strong>project brain</strong> (<Inline>get_project</Inline> — goal,
            owner, agent team, links, history), the <strong>features</strong> (<Inline>list_features</Inline>/
            <Inline>get_feature</Inline> — what the product does), and queries components, capabilities, context,
            sequences, processes, the data model, and the API surface; gets cross-repo link suggestions (
            <Inline>suggest_links</Inline>); and can{" "}
            <Inline>refresh</Inline> or <Inline>sync</Inline> the model — instead of reading source files. After code changes, the agent calls <Inline>refresh</Inline> (or you re-run{" "}
            <Inline>archmantic analyze</Inline>) so answers reflect reality.
          </p>
          <p>
            <strong>Agents that don&apos;t speak MCP</strong> (Cursor, Copilot, plain LLM chats) read a repo context
            file. Archmantic auto-writes <Inline>AGENTS.md</Inline> from the same model — a concise, grounded summary in a
            managed block — on every <Inline>analyze</Inline>/<Inline>update</Inline>, so it never drifts. Refresh it
            anytime with <Inline>archmantic knowledge</Inline>; your own notes around the block are preserved.
          </p>
          <p>
            Every tool call is recorded with the tokens it saved. See it in the terminal with{" "}
            <Inline>archmantic usage</Inline>, or on the team <Link href="/usage">Usage dashboard</Link> (the MCP server
            flushes events to the cloud when a token is set).
          </p>
        </Section>

        <Section id="monorepo" title="Monorepos">
          <p>
            One repo, many packages? Archmantic analyzes a monorepo as a <strong>single model</strong>. It reads your
            declared workspaces (npm/yarn <Inline>workspaces</Inline>, <Inline>pnpm-workspace.yaml</Inline>) and falls
            back to convention (<Inline>apps/*</Inline>, <Inline>packages/*</Inline>, <Inline>services/*</Inline>, …), so
            an undeclared Turborepo/Nx layout works too.
          </p>
          <p>
            Every component, endpoint, and data entity is tagged with its owning <strong>package</strong>, and the
            project view lets you group Components and the API by package (with a “Monorepo · N packages” overview). An
            independent nested app that isn&apos;t a workspace member stays out of the model.
          </p>
        </Section>

        <Section id="multirepo" title="Multi-repo systems">
          <p>
            Microservices or split front/back repos? Declare each repo&apos;s place in the larger system with{" "}
            <Inline>.archmantic/config.json</Inline>:
          </p>
          <Code>{`{
  "system": "payments-platform",
  "consumes": ["ledger-service", "notifications"]
}`}</Code>
          <p>
            Push each repo, then open <Link href="/systems">Systems</Link> for a unified cross-service context diagram and
            drill-down — no central config, each repo declares its own edges.
          </p>
          <p>
            The Systems page also <strong>auto-links</strong> your repos: it flags{" "}
            <strong>inferred</strong> couplings (a repo imports something matching a sibling repo but hasn&apos;t declared
            it) and <strong>dangling</strong> ones (a declared <Inline>consumes</Inline> with no matching repo — a real
            gap), alongside the confirmed <strong>connected</strong> links.
          </p>
        </Section>

        <Section id="ci" title="CI / PR diffs">
          <p>
            A reusable GitHub Action comments on each PR with the <strong>architecture-level</strong> delta — new or
            removed components, capabilities, data-model entities, and external systems — not a line diff. It keeps a
            single sticky comment, updated on every push.
          </p>
          <Code>{`# .github/workflows/architecture-diff.yml
name: Architecture diff
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: mgionas/Archmantic@v1`}</Code>
          <p>
            Inputs: <Inline>base-ref</Inline> (default: the PR base branch), <Inline>working-directory</Inline>,{" "}
            <Inline>version</Inline>, <Inline>comment</Inline>, and <Inline>github-token</Inline>. It runs{" "}
            <Inline>archmantic diff</Inline> under the hood — no install step needed.
          </p>
        </Section>

        <Section id="edit-build" title="Edit-then-build">
          <p>The model is a source you can edit, not just a read-out:</p>
          <Code>{`npx archmantic spec               # emit an agent-ready build spec from the model
npx archmantic handoff            # → an implementation plan (Claude, BYOK)
npx archmantic handoff --apply    # autonomous agent edits the repo and self-verifies`}</Code>
          <p>
            Edit the BPMN canvas in the web app, <Inline>apply</Inline> it back into the model, emit a build spec, and
            hand it to an agent that implements <em>and</em> verifies (runs build + tests, fixes failures until green).
            Commit first; review with <Inline>git diff</Inline>.
          </p>
        </Section>

        <footer className="pt-2 text-sm text-muted-foreground">
          More detail in the{" "}
          <a href="https://github.com/mgionas/Archmantic#readme">README</a> and{" "}
          <a href="https://github.com/mgionas/Archmantic/tree/main/docs">docs/</a> on GitHub.
        </footer>
      </article>
    </div>
  );
}
