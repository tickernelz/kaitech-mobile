import type { DiagramBlock, DiagramEdge, DiagramNode, Tone } from './read';
import { dayOf } from './format';

const DAY = 86400000;
const LINE = 14;
const CHAR = 6.6;
const ARROW = 7;
const SPREAD = [0, 5, -5, 10, -10];
const GUTTER_SPREAD = [0, 3, -3, 6, -6];
const ELLIPSIS = '\u2026';

export type Anchor = 'start' | 'middle' | 'end';
export type Shape =
  | { el: 'rect'; key: number; x: number; y: number; w: number; h: number; r: number; cls: string }
  | { el: 'path'; key: number; d: string; cls: string }
  | { el: 'circle'; key: number; cx: number; cy: number; r: number; cls: string }
  | { el: 'text'; key: number; x: number; y: number; text: string; cls: string; anchor: Anchor };
export type Step = {
  key: string;
  text: string;
  number?: number;
  chip?: string;
  note?: string;
  tone?: Tone | null;
  depth?: number;
  relation?: string;
  target?: string;
  outs?: { key: number; label: string; target: string; back: boolean }[];
};
export type Picture = { width: number; height: number; shapes: Shape[]; steps: Step[] };
type Label = { x: number; y: number; text: string; anchor?: Anchor };
type Pair = [number, number];
type Box = [number, number, number, number];

export function wrap(text: string, width: number, most: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of (text || '').split(/\s+/).filter(Boolean)) {
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += ' ' + word;
    else {
      lines.push(line);
      line = word;
    }
    while (line.length > width) {
      lines.push(line.slice(0, width));
      line = line.slice(width);
    }
  }
  if (line) lines.push(line);
  if (lines.length > most) {
    const kept = lines.slice(0, most);
    kept[most - 1] = kept[most - 1].slice(0, width - 1) + ELLIPSIS;
    return kept;
  }
  return lines;
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function toneClass(tone: Tone | null): string {
  return tone ? ' tone_' + tone : '';
}

class Canvas {
  shapes: Shape[] = [];

  rect(x: number, y: number, w: number, h: number, cls: string, r = 6) {
    this.shapes.push({ el: 'rect', key: this.shapes.length, x: round(x), y: round(y), w: round(w), h: round(h), r, cls });
  }

  path(d: string, cls: string) {
    this.shapes.push({ el: 'path', key: this.shapes.length, d, cls });
  }

  circle(cx: number, cy: number, r: number, cls: string) {
    this.shapes.push({ el: 'circle', key: this.shapes.length, cx: round(cx), cy: round(cy), r, cls });
  }

  text(x: number, y: number, text: string, cls: string, anchor: Anchor = 'middle') {
    this.shapes.push({ el: 'text', key: this.shapes.length, x: round(x), y: round(y), text, cls, anchor });
  }

  label(x: number, cy: number, text: string, chars: number, most: number, cls: string, anchor: Anchor = 'middle'): number {
    const lines = wrap(text, chars, most);
    const top = cy - ((lines.length - 1) * LINE) / 2 + 4;
    lines.forEach((line, index) => this.text(x, top + index * LINE, line, cls, anchor));
    return lines.length;
  }

  line(points: Pair[], cls: string) {
    this.path(points.map(([x, y], index) => (index ? 'L' : 'M') + round(x) + ' ' + round(y)).join(''), cls);
  }

  arrow(points: Pair[], cls: string, label: Label | null | false | '') {
    this.line(points, 'edge ' + cls);
    const [x2, y2] = points[points.length - 1];
    const [x1, y1] = points[points.length - 2];
    const length = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / length;
    const uy = (y2 - y1) / length;
    const bx = x2 - ux * ARROW;
    const by = y2 - uy * ARROW;
    this.line(
      [
        [x2, y2],
        [bx - uy * 4, by + ux * 4],
        [bx + uy * 4, by - ux * 4],
      ],
      'head ' + cls,
    );
    if (label) this.text(label.x, label.y, label.text, 'edge_label ' + cls, label.anchor ?? 'start');
  }
}

type Item = {
  node: DiagramNode;
  order: number;
  out: DiagramEdge[];
  in: DiagramEdge[];
  lane: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  cellLeft: number;
  cellRight: number;
};

function graphOf(nodes: DiagramNode[], edges: DiagramEdge[]): Map<string, Item> {
  const byId = new Map<string, Item>(
    nodes.map((node, order) => [node.id, { node, order, out: [], in: [], lane: 0, col: 0, x: 0, y: 0, w: 0, h: 0, left: 0, right: 0, top: 0, bottom: 0, cellLeft: 0, cellRight: 0 }]),
  );
  for (const edge of edges) {
    byId.get(edge.from)!.out.push(edge);
    byId.get(edge.to)!.in.push(edge);
  }
  return byId;
}

function backEdges(nodes: DiagramNode[], byId: Map<string, Item>): Set<DiagramEdge> {
  const back = new Set<DiagramEdge>();
  const seen = new Map<string, number>();
  const visit = (id: string) => {
    seen.set(id, 1);
    for (const edge of byId.get(id)!.out) {
      const state = seen.get(edge.to);
      if (state === 1) back.add(edge);
      else if (!state) visit(edge.to);
    }
    seen.set(id, 2);
  };
  for (const node of nodes) {
    if (!byId.get(node.id)!.in.length && !seen.has(node.id)) visit(node.id);
  }
  for (const node of nodes) {
    if (!seen.has(node.id)) visit(node.id);
  }
  return back;
}

function topologicalOrder(nodes: DiagramNode[], byId: Map<string, Item>, back: Set<DiagramEdge>): Item[] {
  const waiting = new Map(nodes.map((node) => [node.id, 0]));
  for (const item of byId.values()) {
    for (const edge of item.out) {
      if (!back.has(edge)) waiting.set(edge.to, waiting.get(edge.to)! + 1);
    }
  }
  const ready = nodes.filter((node) => !waiting.get(node.id)).map((node) => byId.get(node.id)!);
  const order: Item[] = [];
  while (ready.length) {
    ready.sort((left, right) => left.order - right.order);
    const item = ready.shift()!;
    order.push(item);
    for (const edge of item.out) {
      if (!back.has(edge)) {
        waiting.set(edge.to, waiting.get(edge.to)! - 1);
        if (!waiting.get(edge.to)) ready.push(byId.get(edge.to)!);
      }
    }
  }
  return order;
}

const FLOW = { head: 116, col: 156, lane: 96, gutter: 10, step: [128, 50] as Pair, decision: [104, 60] as Pair, term: [108, 34] as Pair };

function flowSize(shape: string | null): Pair {
  return shape === 'decision' ? FLOW.decision : shape === 'start' || shape === 'end' ? FLOW.term : FLOW.step;
}

function placeFlow(order: Item[], byId: Map<string, Item>, back: Set<DiagramEdge>, lanes: string[]) {
  const taken = new Set<string>();
  const cell = (lane: number, col: number) => lane + ':' + col;
  const between = (from: number, to: number, col: number) => {
    const cells: string[] = [];
    for (let lane = Math.min(from, to) + 1; lane < Math.max(from, to); lane++) cells.push(cell(lane, col));
    return cells;
  };
  let columns = 1;
  for (const item of order) {
    item.lane = lanes.indexOf(item.node.lane);
    const before = item.in.filter((edge) => !back.has(edge)).map((edge) => byId.get(edge.from)!);
    let col = 0;
    for (const from of before) col = Math.max(col, from.lane === item.lane ? from.col + 1 : from.col);
    const fits = (at: number) => !taken.has(cell(item.lane, at)) && before.every((from) => from.col !== at || between(from.lane, item.lane, at).every((key) => !taken.has(key)));
    while (!fits(col)) col++;
    item.col = col;
    taken.add(cell(item.lane, col));
    for (const from of before) {
      if (from.col === col) between(from.lane, item.lane, col).forEach((key) => taken.add(key));
    }
    columns = Math.max(columns, col + 1);
  }
  return {
    columns,
    free: (lane: number, from: number, to: number) => {
      for (let col = from; col <= to; col++) {
        if (taken.has(cell(lane, col))) return false;
      }
      return true;
    },
  };
}

function labelBox({ x, y, text, anchor = 'start' }: Label): Box {
  const width = text.length * CHAR;
  const left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  return [left - 2, y - 11, left + width + 2, y + 4];
}

function meets(a: Box, b: Box): boolean {
  return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
}

function labelSpots(label: Label, points: Pair[]): Label[] {
  const spots = [label];
  const text = label.text;
  for (let index = 1; index < points.length; index++) {
    const [x1, y1] = points[index - 1];
    const [x2, y2] = points[index];
    if (x1 === x2 && Math.abs(y2 - y1) >= 16) {
      const down = y2 > y1;
      for (let y = down ? y1 + 12 : y1 - 4; down ? y <= y2 - 4 : y >= y2 + 12; y += down ? LINE : -LINE) {
        spots.push({ x: x1 + 6, y, text }, { x: x1 - 6, y, text, anchor: 'end' });
      }
    } else if (y1 === y2 && Math.abs(x2 - x1) >= 10) {
      const ends: { x: number; anchor?: Anchor }[] = x2 > x1 ? [{ x: x1 + 5 }, { x: x2 - 5, anchor: 'end' }] : [{ x: x1 - 5, anchor: 'end' }, { x: x2 + 5 }];
      for (const end of ends) spots.push({ ...end, y: y1 - 4, text }, { ...end, y: y1 + 12, text });
    }
  }
  return spots;
}

export function flowLayout(block: DiagramBlock): Picture {
  const lanes = block.lanes;
  const nodes = block.nodes;
  const byId = graphOf(nodes, block.edges);
  const back = backEdges(nodes, byId);
  const order = topologicalOrder(nodes, byId, back);
  const { columns, free } = placeFlow(order, byId, back, lanes);
  const width = FLOW.head + columns * FLOW.col + 8;
  const height = lanes.length * FLOW.lane + 2;
  const canvas = new Canvas();
  lanes.forEach((lane, index) => {
    const top = index * FLOW.lane;
    canvas.rect(0, top, width, FLOW.lane, 'lane' + (index % 2 ? ' lane_alt' : ''), 0);
    canvas.rect(0, top, FLOW.head - 12, FLOW.lane, 'lane_head', 0);
    canvas.label((FLOW.head - 12) / 2, top + FLOW.lane / 2, lane, 15, 4, 'lane_label');
  });
  for (const item of order) {
    const [w, h] = flowSize(item.node.shape);
    item.x = FLOW.head + item.col * FLOW.col + FLOW.col / 2;
    item.y = item.lane * FLOW.lane + FLOW.lane / 2;
    item.w = w;
    item.h = h;
    item.cellLeft = FLOW.head + item.col * FLOW.col;
    item.cellRight = FLOW.head + (item.col + 1) * FLOW.col;
    item.left = item.x - w / 2;
    item.right = item.x + w / 2;
    item.top = item.y - h / 2;
    item.bottom = item.y + h / 2;
  }
  const blocked: Box[] = order.map((item) => [item.left, item.top, item.right, item.bottom]);
  const written: Box[] = [];
  const clear = (box: Box) =>
    box[0] >= FLOW.head - 12 && box[1] >= 0 && box[2] <= width && box[3] <= height && !blocked.some((other) => meets(box, other)) && !written.some((other) => meets(box, other));
  const draw = (points: Pair[], cls: string, label: Label | null | '' | false) => {
    const placed = label ? (labelSpots(label, points).find((spot) => clear(labelBox(spot))) ?? label) : null;
    if (placed) written.push(labelBox(placed));
    canvas.arrow(points, cls, placed);
  };
  const used = new Map<string, number>();
  const spread = (key: string) => {
    const count = used.get(key) ?? 0;
    used.set(key, count + 1);
    return (key[0] === 'c' ? SPREAD : GUTTER_SPREAD)[count % SPREAD.length];
  };
  const laneTop = (lane: number) => lane * FLOW.lane;
  const nearGutter = (lane: number, below: boolean) => (below ? laneTop(lane) + FLOW.gutter : laneTop(lane) + FLOW.lane - FLOW.gutter);
  for (const a of order) {
    let rightUsed = false;
    for (const edge of a.out) {
      const b = byId.get(edge.to)!;
      const text = edge.label;
      if (back.has(edge)) {
        const gutter = laneTop(a.lane) + FLOW.lane - FLOW.gutter + spread('g' + a.lane);
        const channel = b.cellLeft + spread('c' + b.col);
        draw(
          [
            [a.x, a.bottom],
            [a.x, gutter],
            [channel, gutter],
            [channel, b.y],
            [b.left, b.y],
          ],
          'back',
          text && { x: (a.x + channel) / 2, y: gutter - 4, text, anchor: 'middle' },
        );
        continue;
      }
      if (b.col === a.col) {
        const [y1, y2] = b.lane > a.lane ? [a.bottom, b.top] : [a.top, b.bottom];
        draw(
          [
            [a.x, y1],
            [a.x, y2],
          ],
          '',
          text && { x: a.x + 6, y: (y1 + y2) / 2 + 4, text },
        );
        continue;
      }
      const channelIn = b.cellLeft + spread('c' + b.col);
      if (!rightUsed) {
        rightUsed = true;
        const label = text && { x: a.right + 5, y: a.y - 6, text };
        if (a.lane === b.lane && free(a.lane, a.col + 1, b.col - 1)) {
          draw(
            [
              [a.right, a.y],
              [b.left, b.y],
            ],
            '',
            label,
          );
        } else if (a.lane === b.lane) {
          const gutter = laneTop(a.lane) + FLOW.gutter + spread('t' + a.lane);
          draw(
            [
              [a.x, a.top],
              [a.x, gutter],
              [b.x, gutter],
              [b.x, b.top],
            ],
            '',
            text && { x: a.x + 6, y: gutter - 3, text },
          );
        } else if (free(a.lane, a.col + 1, b.col - 1)) {
          draw(
            [
              [a.right, a.y],
              [channelIn, a.y],
              [channelIn, b.y],
              [b.left, b.y],
            ],
            '',
            label,
          );
        } else {
          const channel = a.cellRight + spread('c' + (a.col + 1));
          const turn = nearGutter(b.lane, b.lane > a.lane);
          const route: Pair[] = free(b.lane, a.col + 1, b.col - 1)
            ? [
                [a.right, a.y],
                [channel, a.y],
                [channel, b.y],
                [b.left, b.y],
              ]
            : [
                [a.right, a.y],
                [channel, a.y],
                [channel, turn],
                [channelIn, turn],
                [channelIn, b.y],
                [b.left, b.y],
              ];
          draw(route, '', label);
        }
        continue;
      }
      const down = b.lane >= a.lane;
      const own = nearGutter(a.lane, !down);
      const channel = a.cellRight + spread('c' + (a.col + 1));
      const start: Pair = [a.x, down ? a.bottom : a.top];
      const label = text && { x: a.x + 6, y: down ? a.bottom + 12 : a.top - 4, text };
      const turn = nearGutter(b.lane, b.lane > a.lane);
      const route: Pair[] = free(b.lane, a.col + 1, b.col - 1)
        ? [start, [a.x, own], [channel, own], [channel, b.y], [b.left, b.y]]
        : [start, [a.x, own], [channel, own], [channel, turn], [channelIn, turn], [channelIn, b.y], [b.left, b.y]];
      draw(route, '', label);
    }
  }
  for (const { x, y, w, h, node } of order) {
    const tone = toneClass(node.tone);
    if (node.shape === 'decision') {
      canvas.line(
        [
          [x, y - h / 2],
          [x + w / 2, y],
          [x, y + h / 2],
          [x - w / 2, y],
          [x, y - h / 2],
        ],
        'decision' + tone,
      );
      canvas.label(x, y, node.label, 12, 2, 'text small');
    } else if (node.shape === 'start' || node.shape === 'end') {
      canvas.rect(x - w / 2, y - h / 2, w, h, 'term ' + node.shape + tone, h / 2);
      canvas.label(x, y, node.label, 15, 1, 'term_text');
    } else {
      canvas.rect(x - w / 2, y - h / 2, w, h, 'node' + tone, 7);
      canvas.label(x, y, node.label, 18, 3, 'text');
    }
  }
  const steps: Step[] = order.map((item, index) => ({
    key: item.node.id,
    number: index + 1,
    text: item.node.label,
    chip: item.node.lane,
    note: item.node.detail,
    tone: item.node.tone,
    outs: item.out.map((edge, position) => ({ key: position, label: edge.label, target: byId.get(edge.to)!.node.label, back: back.has(edge) })),
  }));
  return { width, height, shapes: canvas.shapes, steps };
}

const ORG = { w: 152, h: 52, gap: 14, level: 92, comb: 4, indent: 22, pitch: 62, pad: 8 };

export function orgLayout(block: DiagramBlock): Picture {
  const nodes = block.nodes;
  const kids = new Map<string, DiagramNode[]>(nodes.map((node) => [node.id, []]));
  const roots: DiagramNode[] = [];
  for (const node of nodes) {
    if (node.parent !== null && kids.has(node.parent)) kids.get(node.parent)!.push(node);
    else roots.push(node);
  }
  const placed = new Map<string, { node: DiagramNode; x: number; y: number; comb?: boolean }>();
  let nextX = ORG.pad;
  let bottom = 0;
  const place = (node: DiagramNode, depth: number): number => {
    const children = kids.get(node.id)!;
    const y = ORG.pad + depth * ORG.level;
    bottom = Math.max(bottom, y + ORG.h);
    if (children.length > ORG.comb && children.every((child) => !kids.get(child.id)!.length)) {
      const left = nextX;
      placed.set(node.id, { node, x: left + ORG.w / 2, y, comb: true });
      children.forEach((child, index) => {
        const cy = y + ORG.level - 10 + index * ORG.pitch;
        placed.set(child.id, { node: child, x: left + ORG.indent + ORG.w / 2, y: cy });
        bottom = Math.max(bottom, cy + ORG.h);
      });
      nextX = left + ORG.indent + ORG.w + ORG.gap;
      return left + ORG.w / 2;
    }
    if (!children.length) {
      const x = nextX + ORG.w / 2;
      nextX += ORG.w + ORG.gap;
      placed.set(node.id, { node, x, y });
      return x;
    }
    const xs = children.map((child) => place(child, depth + 1));
    const x = (xs[0] + xs[xs.length - 1]) / 2;
    placed.set(node.id, { node, x, y });
    return x;
  };
  roots.forEach((root) => place(root, 0));
  const width = Math.max(nextX - ORG.gap + ORG.pad, ORG.w + 2 * ORG.pad);
  const height = bottom + ORG.pad;
  const canvas = new Canvas();
  for (const [id, box] of placed) {
    const children = kids.get(id)!.map((child) => placed.get(child.id)!);
    if (!children.length) continue;
    const last = children[children.length - 1];
    if (box.comb) {
      const spine = box.x - ORG.w / 2 + 12;
      canvas.line(
        [
          [spine, box.y + ORG.h],
          [spine, last.y + ORG.h / 2],
        ],
        'edge',
      );
      for (const child of children) {
        canvas.line(
          [
            [spine, child.y + ORG.h / 2],
            [child.x - ORG.w / 2, child.y + ORG.h / 2],
          ],
          'edge',
        );
      }
      continue;
    }
    const mid = box.y + ORG.h + (ORG.level - ORG.h) / 2;
    canvas.line(
      [
        [box.x, box.y + ORG.h],
        [box.x, mid],
      ],
      'edge',
    );
    canvas.line(
      [
        [children[0].x, mid],
        [last.x, mid],
      ],
      'edge',
    );
    for (const child of children) {
      canvas.line(
        [
          [child.x, mid],
          [child.x, child.y],
        ],
        'edge',
      );
    }
  }
  for (const { node, x, y } of placed.values()) {
    const top = node.parent === null || !kids.has(node.parent);
    canvas.rect(x - ORG.w / 2, y, ORG.w, ORG.h, 'node' + (top ? ' top' : '') + toneClass(node.tone), 7);
    if (node.detail) {
      canvas.label(x, y + 18, node.label, 22, 1, 'text strong');
      canvas.label(x, y + 36, node.detail, 24, 1, 'sub');
    } else {
      canvas.label(x, y + ORG.h / 2, node.label, 22, 2, 'text strong');
    }
  }
  const steps: Step[] = [];
  const walk = (node: DiagramNode, depth: number) => {
    steps.push({ key: node.id, text: node.label, note: node.detail, tone: node.tone, depth });
    kids.get(node.id)!.forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((root) => walk(root, 0));
  return { width, height, shapes: canvas.shapes, steps };
}

const TIME = { step: 136, pad: 72, axis: 52 };

export function timelineLayout(block: DiagramBlock, formatDay: (day: number) => string): Picture {
  const items = block.nodes.map((node, order) => ({ node, order, day: dayOf(node.date) }));
  items.sort((left, right) => left.day - right.day || left.order - right.order);
  const width = 2 * TIME.pad + Math.max(1, items.length - 1) * TIME.step;
  const canvas = new Canvas();
  canvas.line(
    [
      [TIME.pad / 2, TIME.axis],
      [width - TIME.pad / 2, TIME.axis],
    ],
    'axis',
  );
  let height = 0;
  const step = items.length > 1 ? (width - 2 * TIME.pad) / (items.length - 1) : 0;
  items.forEach((item, index) => {
    const x = items.length > 1 ? TIME.pad + index * step : width / 2;
    canvas.text(x, TIME.axis - 20, formatDay(item.day), 'sub');
    canvas.circle(x, TIME.axis, 8, 'milestone' + (item.node.tone ? toneClass(item.node.tone) : ' planned'));
    const lines = canvas.label(x, TIME.axis + 32, item.node.label, 19, 3, 'text strong');
    let y = TIME.axis + 32 + ((lines - 1) * LINE) / 2 + LINE;
    if (item.node.detail) {
      const more = canvas.label(x, y + 4, item.node.detail, 21, 2, 'sub');
      y += more * LINE;
    }
    height = Math.max(height, y + 12);
  });
  const steps = items.map((item) => ({ key: item.node.id, chip: formatDay(item.day), text: item.node.label, note: item.node.detail, tone: item.node.tone }));
  return { width, height, shapes: canvas.shapes, steps };
}

const GANTT = { left: 176, plot: 520, row: 30, top: 30, bar: 16 };

export function ganttLayout(block: DiagramBlock, formatDay: (day: number) => string, formatMonth: (day: number) => string, todayLabel: string): Picture {
  const rows = block.nodes.map((node) => ({ node, start: dayOf(node.start), end: dayOf(node.end), x: 0, x2: 0, y: 0 }));
  const today = block.today ? dayOf(block.today) : null;
  let first = Math.min(...rows.map((row) => row.start));
  let last = Math.max(...rows.map((row) => row.end));
  if (today !== null) {
    first = Math.min(first, today);
    last = Math.max(last, today);
  }
  const days = last - first + 1;
  const scale = GANTT.plot / days;
  const width = GANTT.left + GANTT.plot + 10;
  const height = GANTT.top + rows.length * GANTT.row + 6;
  const canvas = new Canvas();
  const weekly = days <= 98;
  const ticks: number[] = [];
  for (let day = first; day <= last; day++) {
    const date = new Date(day * DAY);
    if (weekly ? date.getUTCDay() === 1 : date.getUTCDate() === 1) ticks.push(day);
  }
  const every = Math.max(1, Math.ceil(ticks.length / Math.floor(GANTT.plot / 64)));
  ticks.forEach((day, index) => {
    if (index % every) return;
    const x = GANTT.left + (day - first) * scale;
    canvas.line(
      [
        [x, GANTT.top - 8],
        [x, height],
      ],
      'grid',
    );
    canvas.text(x + 4, GANTT.top - 14, weekly ? formatDay(day) : formatMonth(day), 'sub', 'start');
  });
  const byId = new Map<string, (typeof rows)[number]>();
  rows.forEach((row, index) => {
    row.x = GANTT.left + (row.start - first) * scale;
    row.x2 = GANTT.left + (row.end - first + 1) * scale;
    row.y = GANTT.top + index * GANTT.row + GANTT.row / 2;
    byId.set(row.node.id, row);
    canvas.text(0, row.y + 4, wrap(row.node.label, 26, 1)[0], 'text', 'start');
    canvas.rect(row.x, row.y - GANTT.bar / 2, Math.max(3, row.x2 - row.x), GANTT.bar, 'bar' + toneClass(row.node.tone), 4);
  });
  for (const edge of block.edges) {
    const a = byId.get(edge.from)!;
    const b = byId.get(edge.to)!;
    const out = a.x2 + 6;
    if (b.x >= out + 6) {
      canvas.arrow(
        [
          [a.x2, a.y],
          [out, a.y],
          [out, b.y],
          [b.x, b.y],
        ],
        'dependency',
        null,
      );
    } else {
      const middle = (a.y + b.y) / 2;
      canvas.arrow(
        [
          [a.x2, a.y],
          [out, a.y],
          [out, middle],
          [b.x - 6, middle],
          [b.x - 6, b.y],
          [b.x, b.y],
        ],
        'dependency',
        null,
      );
    }
  }
  if (today !== null) {
    const x = GANTT.left + (today - first + 0.5) * scale;
    canvas.line(
      [
        [x, GANTT.top - 4],
        [x, height],
      ],
      'today',
    );
    canvas.text(x + 4, height - 4, todayLabel, 'today_label', 'start');
  }
  const steps = rows.map((row) => ({
    key: row.node.id,
    text: row.node.label,
    chip: row.start === row.end ? formatDay(row.start) : formatDay(row.start) + ' \u2013 ' + formatDay(row.end),
    note: row.node.detail,
    tone: row.node.tone,
  }));
  return { width, height, shapes: canvas.shapes, steps };
}

const RELATION = { w: 128, h: 36, first: 190, ring: 140, squash: 0.62, pad: 12 };

function boxEdge(cx: number, cy: number, dx: number, dy: number): Pair {
  const t = Math.min(RELATION.w / 2 / Math.abs(dx || 1e-9), RELATION.h / 2 / Math.abs(dy || 1e-9));
  return [cx + dx * t, cy + dy * t];
}

function aroundOrder(nodes: DiagramNode[], edges: DiagramEdge[], start: DiagramNode): DiagramNode[] {
  const next = new Map<string, string[]>(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    next.get(edge.from)!.push(edge.to);
    next.get(edge.to)!.push(edge.from);
  }
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const order: DiagramNode[] = [];
  const visit = (id: string) => {
    seen.add(id);
    order.push(byId.get(id)!);
    for (const other of next.get(id)!) {
      if (!seen.has(other)) visit(other);
    }
  };
  for (const node of [start, ...nodes]) {
    if (!seen.has(node.id)) visit(node.id);
  }
  return order;
}

function relationPlaces(nodes: DiagramNode[], edges: DiagramEdge[], degree: Map<string, number>): Map<string, Pair> {
  const at = new Map<string, Pair>();
  if (nodes.length <= 2) {
    nodes.forEach((node, index) => at.set(node.id, [index * (RELATION.w + 140), 0]));
    return at;
  }
  const busiest = nodes.reduce((best, node) => (degree.get(node.id)! > degree.get(best.id)! ? node : best), nodes[0]);
  const hub = degree.get(busiest.id)! >= 3 && degree.get(busiest.id)! >= 0.6 * edges.length;
  let rest = aroundOrder(nodes, edges, busiest);
  if (hub) {
    at.set(busiest.id, [0, 0]);
    rest = rest.filter((node) => node !== busiest);
  }
  for (let ring = 0, index = 0; index < rest.length; ring++) {
    const rx = RELATION.first + ring * RELATION.ring;
    const ry = rx * RELATION.squash;
    const around = 2 * Math.PI * Math.sqrt((rx * rx + ry * ry) / 2);
    const here = rest.slice(index, index + Math.max(4, Math.floor(around / (RELATION.w + 22))));
    here.forEach((node, position) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * position) / here.length + (ring % 2 ? Math.PI / here.length : 0);
      at.set(node.id, [rx * Math.cos(angle), ry * Math.sin(angle)]);
    });
    index += here.length;
  }
  return at;
}

export function relationLayout(block: DiagramBlock): Picture {
  const nodes = block.nodes;
  const edges = block.edges;
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    degree.set(edge.from, degree.get(edge.from)! + 1);
    degree.set(edge.to, degree.get(edge.to)! + 1);
  }
  const at = relationPlaces(nodes, edges, degree);
  const xs = [...at.values()].map(([x]) => x);
  const ys = [...at.values()].map(([, y]) => y);
  const shiftX = RELATION.w / 2 + RELATION.pad - Math.min(...xs);
  const shiftY = RELATION.h / 2 + RELATION.pad + 8 - Math.min(...ys);
  for (const [id, [x, y]] of at) at.set(id, [x + shiftX, y + shiftY]);
  const width = Math.max(...xs) - Math.min(...xs) + RELATION.w + 2 * RELATION.pad;
  const height = Math.max(...ys) - Math.min(...ys) + RELATION.h + 2 * RELATION.pad + 16;
  const canvas = new Canvas();
  const pairs = new Set(edges.map((edge) => edge.from + '\u0000' + edge.to));
  for (const edge of edges) {
    const [ax, ay] = at.get(edge.from)!;
    const [bx, by] = at.get(edge.to)!;
    const length = Math.hypot(bx - ax, by - ay) || 1;
    const bend = pairs.has(edge.to + '\u0000' + edge.from) ? 16 : 0;
    const mx = (ax + bx) / 2 - ((by - ay) / length) * bend;
    const my = (ay + by) / 2 + ((bx - ax) / length) * bend;
    const start = boxEdge(ax, ay, mx - ax, my - ay);
    const end = boxEdge(bx, by, mx - bx, my - by);
    canvas.arrow([start, [mx, my], end], '', edge.label && { x: mx, y: my - 4, text: edge.label, anchor: 'middle' });
  }
  for (const node of nodes) {
    const [x, y] = at.get(node.id)!;
    canvas.rect(x - RELATION.w / 2, y - RELATION.h / 2, RELATION.w, RELATION.h, 'node' + toneClass(node.tone), RELATION.h / 2);
    canvas.label(x, y, node.label, 18, 2, 'text small');
  }
  const labelOf = new Map(nodes.map((node) => [node.id, node.label]));
  const linked = new Set(edges.flatMap((edge) => [edge.from, edge.to]));
  const steps: Step[] = [
    ...edges.map((edge, index) => ({ key: 'e' + index, text: labelOf.get(edge.from)!, relation: edge.label, target: labelOf.get(edge.to)! })),
    ...nodes.filter((node) => !linked.has(node.id)).map((node) => ({ key: node.id, text: node.label, note: node.detail, tone: node.tone })),
  ];
  return { width, height, shapes: canvas.shapes, steps };
}

const ARCH = { col: 200, gap: 40, head: 34, box: 34, pitch: 42, pad: 10 };

export function architectureLayout(block: DiagramBlock): Picture {
  const lanes = block.lanes;
  const canvas = new Canvas();
  const stacks: DiagramNode[][] = lanes.map(() => []);
  for (const node of block.nodes) stacks[lanes.indexOf(node.lane)].push(node);
  const rows = Math.max(1, ...stacks.map((stack) => stack.length));
  const width = lanes.length * ARCH.col + (lanes.length - 1) * ARCH.gap;
  const height = ARCH.head + rows * ARCH.pitch + ARCH.pad;
  const at = new Map<string, { x: number; y: number; w: number; col: number }>();
  stacks.forEach((stack, index) => {
    const x = index * (ARCH.col + ARCH.gap);
    canvas.rect(x, 0, ARCH.col, height, 'column', 8);
    canvas.text(x + 10, 21, wrap(lanes[index], 26, 1)[0], 'column_label', 'start');
    stack.forEach((node, row) => {
      const box = { x: x + 8, y: ARCH.head + row * ARCH.pitch, w: ARCH.col - 16, col: index };
      at.set(node.id, box);
      canvas.rect(box.x, box.y, box.w, ARCH.box, 'system' + toneClass(node.tone), 6);
      const tag = node.detail ? wrap(node.detail, 10, 1)[0] : '';
      const room = Math.floor((box.w - 18 - (tag ? tag.length * CHAR + 8 : 0)) / CHAR);
      canvas.text(box.x + 8, box.y + 21, wrap(node.label, Math.max(6, room), 1)[0], 'text', 'start');
      if (tag) canvas.text(box.x + box.w - 8, box.y + 21, tag, 'tag', 'end');
    });
  });
  for (const edge of block.edges) {
    const a = at.get(edge.from)!;
    const b = at.get(edge.to)!;
    const ay = a.y + ARCH.box / 2;
    const by = b.y + ARCH.box / 2;
    let points: Pair[];
    if (b.col > a.col) {
      const mid = b.x - ARCH.gap / 2 - 8;
      points = [
        [a.x + a.w, ay],
        [mid, ay],
        [mid, by],
        [b.x, by],
      ];
    } else if (b.col < a.col) {
      const mid = b.x + b.w + ARCH.gap / 2 + 8;
      points = [
        [a.x, ay],
        [mid, ay],
        [mid, by],
        [b.x + b.w, by],
      ];
    } else {
      const out = a.x + a.w + 14;
      points = [
        [a.x + a.w, ay],
        [out, ay],
        [out, by],
        [b.x + b.w, by],
      ];
    }
    canvas.arrow(points, '', edge.label && { x: points[1][0] + 4, y: (ay + by) / 2 - 4, text: edge.label });
  }
  const labelOf = new Map(block.nodes.map((node) => [node.id, node.label]));
  const steps: Step[] = [
    ...block.nodes.map((node) => ({ key: node.id, chip: node.lane, text: node.label, note: node.detail, tone: node.tone })),
    ...block.edges.map((edge, index) => ({ key: 'e' + index, text: labelOf.get(edge.from)!, relation: edge.label, target: labelOf.get(edge.to)! })),
  ];
  return { width, height, shapes: canvas.shapes, steps };
}
