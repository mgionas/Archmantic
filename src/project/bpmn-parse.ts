/**
 * BPMN 2.0 parser — the inverse of `bpmn.ts`. Turns a (human-edited) BPMN
 * diagram back into an ordered process so canvas edits can flow into the IR
 * (the "edit" half of edit-then-build).
 *
 * Dependency-free: BPMN here comes from bpmn-js (consistent structure). We read
 * the flow elements and order tasks by following sequenceFlows from the start
 * event, falling back to document order.
 */

export interface ParsedProcess {
  name: string;
  tasks: { name: string }[];
}

const attr = (tag: string, name: string): string | undefined =>
  new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1];

export function parseBpmnProcess(xml: string): ParsedProcess | null {
  if (!xml || !/<\w*:?process\b/.test(xml)) return null;

  const procName = (() => {
    const t = /<\w*:?process\b[^>]*>/.exec(xml)?.[0];
    return (t && attr(t, "name")) || "Process";
  })();

  const tasks = new Map<string, string>(); // id → name
  const flowNext = new Map<string, string>(); // sourceRef → targetRef (first wins)
  let startId: string | undefined;

  const re = /<(\w*:?)(task|userTask|serviceTask|scriptTask|startEvent|endEvent|sequenceFlow)\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const kind = m[2]!;
    const body = `<x ${m[3]} >`;
    const id = attr(body, "id");
    if (kind === "startEvent") {
      startId = id;
    } else if (kind === "sequenceFlow") {
      const from = attr(body, "sourceRef");
      const to = attr(body, "targetRef");
      if (from && to && !flowNext.has(from)) flowNext.set(from, to);
    } else if (kind.toLowerCase().includes("task")) {
      if (id) tasks.set(id, attr(body, "name") ?? id);
    }
  }

  // Order by walking the flow chain from the start event.
  const ordered: { name: string }[] = [];
  const seen = new Set<string>();
  let cur = startId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (tasks.has(cur)) ordered.push({ name: tasks.get(cur)! });
    cur = flowNext.get(cur);
  }
  // Fallback: document order if the chain didn't yield tasks.
  if (!ordered.length) for (const name of tasks.values()) ordered.push({ name });

  return { name: procName, tasks: ordered };
}
