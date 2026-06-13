/**
 * BPMN 2.0 projection (USP 2: auto business-process view — white space nobody
 * in the code-graph crowd occupies).
 *
 * Emits standards-compliant BPMN 2.0 XML *with* DI (diagram interchange)
 * coordinates, so it renders directly in `bpmn-js` and any BPMN tool. v1 lays a
 * Process out as a linear lane: startEvent → task* → endEvent.
 */
import { type Process } from "../ir/types.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Layout constants (left-to-right).
const EVENT = 36;
const TASK_W = 110;
const TASK_H = 80;
const GAP = 50;
const Y = 120;

export function bpmnXml(process: Process): string {
  const tasks = process.tasks;
  const startId = "StartEvent_1";
  const endId = "EndEvent_1";
  const taskIds = tasks.map((_, i) => `Activity_${i + 1}`);
  const nodeOrder = [startId, ...taskIds, endId];

  // Flow elements.
  const flowEls: string[] = [];
  const flows: { id: string; from: string; to: string }[] = [];
  for (let i = 0; i < nodeOrder.length - 1; i++) {
    flows.push({ id: `Flow_${i + 1}`, from: nodeOrder[i]!, to: nodeOrder[i + 1]! });
  }
  const outgoing = (id: string) => flows.filter((f) => f.from === id).map((f) => `      <bpmn:outgoing>${f.id}</bpmn:outgoing>`).join("\n");
  const incoming = (id: string) => flows.filter((f) => f.to === id).map((f) => `      <bpmn:incoming>${f.id}</bpmn:incoming>`).join("\n");

  flowEls.push(`    <bpmn:startEvent id="${startId}" name="Start">\n${outgoing(startId)}\n    </bpmn:startEvent>`);
  tasks.forEach((t, i) => {
    const id = taskIds[i]!;
    flowEls.push(
      `    <bpmn:task id="${id}" name="${esc(t.name)}">\n${incoming(id)}\n${outgoing(id)}\n    </bpmn:task>`,
    );
  });
  flowEls.push(`    <bpmn:endEvent id="${endId}" name="End">\n${incoming(endId)}\n    </bpmn:endEvent>`);
  for (const f of flows) {
    flowEls.push(`    <bpmn:sequenceFlow id="${f.id}" sourceRef="${f.from}" targetRef="${f.to}" />`);
  }

  // DI: compute x positions left→right; events are small circles, tasks are boxes.
  const bounds = new Map<string, { x: number; y: number; w: number; h: number; cx: number; cy: number }>();
  let x = 160;
  for (const id of nodeOrder) {
    const isEvent = id === startId || id === endId;
    const w = isEvent ? EVENT : TASK_W;
    const h = isEvent ? EVENT : TASK_H;
    const y = isEvent ? Y + (TASK_H - EVENT) / 2 : Y;
    bounds.set(id, { x, y, w, h, cx: x + w / 2, cy: y + h / 2 });
    x += w + GAP;
  }

  const shapes = nodeOrder
    .map((id) => {
      const b = bounds.get(id)!;
      return (
        `      <bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}">\n` +
        `        <dc:Bounds x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" />\n` +
        `      </bpmndi:BPMNShape>`
      );
    })
    .join("\n");

  const edges = flows
    .map((f) => {
      const a = bounds.get(f.from)!;
      const b = bounds.get(f.to)!;
      return (
        `      <bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}">\n` +
        `        <di:waypoint x="${a.x + a.w}" y="${a.cy}" />\n` +
        `        <di:waypoint x="${b.x}" y="${b.cy}" />\n` +
        `      </bpmndi:BPMNEdge>`
      );
    })
    .join("\n");

  const procId = `Process_${process.id.replace(/[^A-Za-z0-9]/g, "_")}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_archmantic"
                  targetNamespace="http://archmantic/bpmn">
  <bpmn:process id="${procId}" name="${esc(process.name)}" isExecutable="false">
${flowEls.join("\n")}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${procId}">
${shapes}
${edges}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}
