import type { DiagramBlock, Tone } from '../discovery/kt/read';

export type ArchitectureNode = { key: string; id: number; title: string; sub: string; column: string; home: string; status: string; body: string[]; points: string[]; facts: [string, string][]; gap: string; note: string };

export type ArchitecturePayload = {
  title: string;
  notes: string[];
  statuses: [string, string][];
  columns: { key: string; label: string }[];
  nodes: ArchitectureNode[];
  links: { from: string; to: string; label: string }[];
};

const statusTones: Record<string, Tone> = { fit: 'good', config: 'good', gap: 'bad', custom: 'warn', hybrid: 'warn', needs_confirmation: 'warn', unverified: 'warn', awaiting_access: 'info', inactive: 'neutral', out_of_scope: 'neutral' };

function clip(text: string, most: number): string {
  return text.length > most ? `${text.slice(0, most - 1)}\u2026` : text;
}

export function architectureBlock(payload: ArchitecturePayload, sideLabel: string): DiagramBlock {
  const labels = new Map(payload.columns.map((column) => [column.key, clip(column.label, 40)]));
  const laneOf = (node: ArchitectureNode) => (node.column === '_side' ? sideLabel : labels.get(node.column) ?? sideLabel);
  const nodes = payload.nodes.map((node) => ({
    id: node.key,
    label: clip(node.title, 80),
    detail: clip(node.sub, 60),
    tone: statusTones[node.status] ?? null,
    lane: laneOf(node),
    shape: null,
    parent: null,
    date: '',
    start: '',
    end: '',
  }));
  const used = new Set(nodes.map((node) => node.lane));
  const lanes = [...payload.columns.map((column) => labels.get(column.key)!), sideLabel].filter((lane, index, all) => used.has(lane) && all.indexOf(lane) === index);
  const known = new Set(nodes.map((node) => node.id));
  return {
    title: payload.title,
    kind: 'architecture',
    lanes,
    nodes,
    edges: payload.links.filter((link) => known.has(link.from) && known.has(link.to)).map((link) => ({ from: link.from, to: link.to, label: clip(link.label, 40) })),
    today: null,
  };
}

export type DiagramPayload = {
  level: string;
  title: string;
  block?: unknown;
  nodes: { key: string; label: string; lane: string; done_by: string; step_labels: string[]; actor_missing: boolean; unconfirmed: boolean }[];
  lanes?: { label: string }[];
  findings: string[];
};

export function processBlock(payload: DiagramPayload, words: { doneBy: string; noActor: string; process: string }): DiagramBlock {
  const swimlane = !!payload.lanes?.length;
  const lanes = swimlane ? payload.lanes!.map((lane) => clip(lane.label || words.noActor, 40)) : [words.process];
  const nodes = payload.nodes.map((node) => ({
    id: node.key,
    label: clip(node.label, 80),
    detail: clip(payload.level === 'executive' ? node.step_labels.join(', ') : node.done_by ? `${words.doneBy} ${node.done_by}` : words.noActor, 60),
    tone: node.actor_missing ? ('bad' as Tone) : node.unconfirmed ? ('warn' as Tone) : null,
    lane: swimlane ? clip(node.lane || words.noActor, 40) : words.process,
    shape: null,
    parent: null,
    date: '',
    start: '',
    end: '',
  }));
  const edges = nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id, label: '' }));
  return { title: payload.title, kind: 'flow', lanes: [...new Set(lanes)], nodes, edges, today: null };
}
