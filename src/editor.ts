/**
 * Local web feature editor (`archmantic edit`). A tiny localhost server whose
 * saves write `.archmantic/features/<slug>.md` directly — repo files stay the
 * source of truth (git-versioned, agent-readable). The hosted web app is
 * read-only (it can't reach your disk); this is how you edit features in a UI.
 * Dependency-light: node:http + an embedded HTML page, no build step.
 */
import { createServer } from "node:http";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { analyzeRepo } from "./analyze/index.js";
import { featureFileMarkdown, slugify, FEATURES_DIR } from "./project/features.js";
import { type Feature } from "./ir/types.js";

const HUMAN_CONFIDENCE = 0.9;

export interface FeatureEdit {
  slug?: string;
  name: string;
  description?: string;
  /** raw lines: "hero slider (from admin)" */
  shows?: string[];
  /** raw lines: "browse vendors — opens the listing" */
  actions?: string[];
  /** feature names */
  dependsOn?: string[];
  /** component paths */
  components?: string[];
  status?: string;
}

const parseShows = (lines: string[]) =>
  lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^(.*?)\s*\((?:from\s+)?([^)]+)\)\s*$/.exec(l);
      return m ? { text: m[1]!.trim(), source: m[2]!.trim() } : { text: l };
    });

const parseActions = (lines: string[]) =>
  lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = /^(.*?)\s*(?:—|--|:)\s*(.+)$/.exec(l);
      return m ? { name: m[1]!.trim(), description: m[2]!.trim() } : { name: l };
    });

/** Write one edited feature to `.archmantic/features/<slug>.md`. Returns the slug. */
export function writeFeatureEdit(root: string, edit: FeatureEdit): string {
  const slug = slugify(edit.name || edit.slug || "feature");
  const f: Feature = {
    id: `feature:${slug}`,
    name: edit.name || slug,
    description: edit.description?.trim() || undefined,
    provenance: [{ source: "human", ref: join(FEATURES_DIR, `${slug}.md`), confidence: HUMAN_CONFIDENCE }],
    confidence: HUMAN_CONFIDENCE,
  };
  const shows = parseShows(edit.shows ?? []);
  const actions = parseActions(edit.actions ?? []);
  if (shows.length) f.shows = shows;
  if (actions.length) f.actions = actions;
  const deps = (edit.dependsOn ?? []).map((n) => n.trim()).filter(Boolean).map((n) => `feature:${slugify(n)}`);
  if (deps.length) f.dependsOn = [...new Set(deps)];
  const comps = (edit.components ?? []).map((c) => c.trim()).filter(Boolean).map((c) => (c.startsWith("comp:") ? c : `comp:${c}`));
  if (comps.length) f.components = [...new Set(comps)];
  if (edit.status) f.status = edit.status;

  mkdirSync(join(root, FEATURES_DIR), { recursive: true });
  writeFileSync(join(root, FEATURES_DIR, `${slug}.md`), featureFileMarkdown(f, (id) => id.replace(/^feature:/, "")), "utf8");
  return slug;
}

/** Current features as the editor's plain-text shape (lines), freshly analyzed. */
export function editorFeatures(root: string): unknown[] {
  const m = analyzeRepo(root);
  const nameById = new Map(m.features.map((f) => [f.id, f.name]));
  return m.features
    .map((f) => ({
      slug: f.id.replace(/^feature:/, ""),
      name: f.name,
      status: f.status ?? null,
      human: f.provenance?.[0]?.source === "human",
      description: f.description ?? "",
      shows: (f.shows ?? []).map((s) => (s.source ? `${s.text} (from ${s.source})` : s.text)),
      actions: (f.actions ?? []).map((a) => (a.description ? `${a.name} — ${a.description}` : a.name)),
      dependsOn: (f.dependsOn ?? []).map((id) => nameById.get(id) ?? id.replace(/^feature:/, "")),
      components: (f.components ?? []).map((c) => c.replace(/^comp:/, "")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Start the local editor server. Resolves only on shutdown. */
export function startEditor(root: string, port = 4517): Promise<void> {
  const server = createServer(async (req, res) => {
    const json = (code: number, body: unknown) => {
      res.writeHead(code, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    try {
      if (req.method === "GET" && (req.url === "/" || req.url === "")) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(EDITOR_HTML);
        return;
      }
      if (req.method === "GET" && req.url === "/api/features") return json(200, { features: editorFeatures(root) });
      if (req.method === "POST" && req.url === "/api/feature") {
        let body = "";
        for await (const chunk of req) body += chunk;
        const slug = writeFeatureEdit(root, JSON.parse(body) as FeatureEdit);
        return json(200, { ok: true, slug });
      }
      res.writeHead(404);
      res.end("not found");
    } catch (err) {
      json(500, { error: err instanceof Error ? err.message : String(err) });
    }
  });
  return new Promise(() => {
    server.listen(port, "127.0.0.1", () => {
      process.stdout.write(
        `\nArchmantic feature editor → http://127.0.0.1:${port}\n` +
          `  Saves write ${FEATURES_DIR}/*.md directly (repo files = source). Review with \`git diff\`, then \`archmantic analyze\`.\n` +
          `  Ctrl-C to stop.\n\n`,
      );
    });
    process.on("SIGINT", () => server.close(() => process.exit(0)));
  });
}

const EDITOR_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Archmantic — feature editor</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,sans-serif;background:#0b0b0f;color:#e7e7ea}
  header{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #23232b;position:sticky;top:0;background:#0b0b0fdd;backdrop-filter:blur(6px)}
  header .dot{width:10px;height:10px;border-radius:3px;background:#7c5cff}
  header b{font-weight:700}
  header small{color:#9a9aa6}
  .wrap{display:grid;grid-template-columns:280px 1fr;min-height:calc(100vh - 49px)}
  .list{border-right:1px solid #23232b;overflow:auto;max-height:calc(100vh - 49px)}
  .list button{display:block;width:100%;text-align:left;border:0;background:none;color:inherit;padding:9px 16px;cursor:pointer;border-bottom:1px solid #18181f}
  .list button:hover{background:#15151c}
  .list button.active{background:#1b1b24;box-shadow:inset 2px 0 0 #7c5cff}
  .list .badge{font-size:11px;color:#9a9aa6}
  .pane{padding:22px 26px;max-width:760px}
  label{display:block;font-size:12px;color:#9a9aa6;margin:16px 0 5px}
  input,textarea{width:100%;background:#121219;border:1px solid #2a2a34;border-radius:8px;color:inherit;padding:9px 11px;font:inherit;resize:vertical}
  textarea{min-height:70px}
  .row{display:flex;gap:10px;align-items:center}
  .btn{background:#7c5cff;border:0;color:#fff;padding:9px 16px;border-radius:8px;font-weight:600;cursor:pointer}
  .btn.ghost{background:#1b1b24;color:#e7e7ea;border:1px solid #2a2a34}
  .hint{color:#76768a;font-size:12px;margin-top:4px}
  .pill{font-size:11px;border:1px solid #2a2a34;border-radius:999px;padding:1px 8px;color:#9a9aa6}
  .ok{color:#4ade80}
  .muted{color:#76768a}
</style></head><body>
<header><span class="dot"></span><b>Archmantic</b><small>feature editor — saves to .archmantic/features/*.md</small>
  <span style="margin-left:auto"></span><button class="btn ghost" id="new">+ New feature</button></header>
<div class="wrap"><div class="list" id="list"></div><div class="pane" id="pane"><p class="muted">Loading…</p></div></div>
<script>
let features=[], current=null;
const $=s=>document.querySelector(s);
async function load(){const r=await fetch('/api/features');features=(await r.json()).features;render();}
function render(){
  const list=$('#list');list.innerHTML='';
  for(const f of features){const b=document.createElement('button');b.className='list-item'+(current&&current.slug===f.slug?' active':'');
    b.innerHTML='<div>'+esc(f.name)+'</div><div class="badge">'+(f.human?'authored':'draft')+(f.components.length?' · '+f.components.length+' comp':'')+'</div>';
    b.onclick=()=>{current=f;render();};list.appendChild(b);}
  $('#pane').innerHTML=current?form(current):'<p class="muted">Select a feature, or create one.</p>';
  if(current){$('#save').onclick=save;}
}
function form(f){return \`
  <div class="row"><h2 style="margin:0">\${esc(f.name)}</h2><span class="pill">\${f.human?'authored':'draft'}</span></div>
  <label>Name</label><input id="f-name" value="\${esc(f.name)}"/>
  <label>Status</label><input id="f-status" value="\${esc(f.status||'')}" placeholder="draft | active"/>
  <label>Description</label><textarea id="f-desc">\${esc(f.description)}</textarea>
  <label>Shows <span class="muted">(one per line; "text (from source)")</span></label><textarea id="f-shows">\${esc(f.shows.join('\\n'))}</textarea>
  <label>Actions <span class="muted">(one per line; "name — description")</span></label><textarea id="f-actions">\${esc(f.actions.join('\\n'))}</textarea>
  <label>Depends on <span class="muted">(comma-separated feature names)</span></label><input id="f-deps" value="\${esc(f.dependsOn.join(', '))}"/>
  <label>Components <span class="muted">(read-only; derived from code)</span></label><input value="\${esc(f.components.join(', '))}" disabled/>
  <div class="row" style="margin-top:20px"><button class="btn" id="save">Save to repo</button><span id="msg" class="hint"></span></div>
  <p class="hint">Writes .archmantic/features/\${esc(f.slug)}.md — review with <code>git diff</code>, then <code>archmantic analyze</code>.</p>\`;}
async function save(){
  const edit={slug:current.slug,name:$('#f-name').value,status:$('#f-status').value||undefined,
    description:$('#f-desc').value,shows:$('#f-shows').value.split('\\n'),actions:$('#f-actions').value.split('\\n'),
    dependsOn:$('#f-deps').value.split(','),components:current.components};
  $('#msg').textContent='Saving…';
  const r=await fetch('/api/feature',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(edit)});
  const j=await r.json();
  if(j.ok){$('#msg').innerHTML='<span class="ok">Saved '+j.slug+'.md</span>';await load();current=features.find(x=>x.slug===j.slug)||current;render();}
  else{$('#msg').textContent='Error: '+(j.error||'failed');}
}
$('#new').onclick=()=>{current={slug:'',name:'New feature',status:'draft',human:true,description:'',shows:[],actions:[],dependsOn:[],components:[]};render();};
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
load();
</script></body></html>`;
