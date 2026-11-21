import type { ChartBlock, ChartKind, Series } from './read';
import type { Numbers } from './format';
import { decimalsOf, withUnit } from './format';

export const DRAWN_POINTS = 400;
const DENSE = 120;
const DOTTED = 40;
const CHAR = 6.4;
const TWO_PI = Math.PI * 2;
const BARS: readonly ChartKind[] = ['bar', 'stacked_bar'];
const STACKED: readonly ChartKind[] = ['stacked_bar', 'stacked_area'];

type Point = { x: number; y: number; low: number } | null;
export type Drawn = { x: (string | number)[]; series: Series[]; size: number };

export type Cartesian = {
  kind: 'cartesian';
  width: number;
  height: number;
  left: number;
  right: number;
  base: number;
  grid: { key: number; y: number; text: string; zero: boolean }[];
  labels: { key: number; x: number; text: string }[];
  bars: { key: number; series: number; x: number; y: number; width: number; height: number }[];
  paths: { key: string; series: number; d: string; line: boolean }[];
  areas: { key: number; series: number; d: string }[];
  dots: { key: number; series: number; x: number; y: number }[];
};
export type Donut = {
  kind: 'donut';
  size: number;
  slices: { key: number; series: number; d: string }[];
  legend: { key: number; series: number; label: string; value: string; share: string }[];
  total: string;
};
export type Gauge = { key: number; series: number; track: string; arc: string; value: string; label: string; max: string };
export type Gauges = { kind: 'gauge'; gauges: Gauge[] };
export type Funnel = {
  kind: 'funnel';
  width: number;
  height: number;
  labelWidth: number;
  rows: { key: number; top: number; label: string; detail: string; x: number; width: number }[];
};
export type Heatmap = {
  kind: 'heatmap';
  width: number;
  height: number;
  cell: number;
  rowLabels: { key: number; y: number; text: string }[];
  columnLabels: { key: number; x: number; text: string }[];
  cells: { key: number; x: number; y: number; level: number; known: boolean; text: string }[];
  low: string;
  high: string;
};
export type Spark = { kind: 'spark'; width: number; height: number; d: string; end: { x: number; y: number } | null; said: string };
export type Figure = Cartesian | Donut | Gauges | Funnel | Heatmap | Spark;
export type Words = { stepBefore: (value: string, share: string) => string; of: (max: string) => string };

export function r1(value: number): number {
  return Math.round(value * 10) / 10;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function linePath(points: ({ x: number; y: number } | null)[]): string {
  let path = '';
  let open = false;
  for (const point of points) {
    if (!point) {
      open = false;
      continue;
    }
    path += (open ? 'L' : 'M') + r1(point.x) + ' ' + r1(point.y);
    open = true;
  }
  return path;
}

export function sparkShape(values: (number | null)[], width: number, height: number) {
  const known = values.filter(isNumber);
  const low = Math.min(...known);
  const high = Math.max(...known);
  const span = high - low || 1;
  const step = values.length > 1 ? (width - 6) / (values.length - 1) : 0;
  const points = values.map((value, position) => (isNumber(value) ? { x: 3 + step * position, y: height - 3 - ((height - 6) * (value - low)) / span } : null));
  const last = [...points].reverse().find(Boolean) ?? null;
  return { d: linePath(points), end: last ? { x: r1(last.x), y: r1(last.y) } : null };
}

export function sparkText(numbers: Numbers, values: (number | null)[], places: number): string {
  const known = values.filter(isNumber);
  if (!known.length) return '';
  return numbers.number(known[0], places) + ' \u2192 ' + numbers.number(known[known.length - 1], places);
}

function average(values: (number | null)[]): number | null {
  let sum = 0;
  let count = 0;
  for (const value of values) {
    if (isNumber(value)) {
      sum += value;
      count++;
    }
  }
  return count ? sum / count : null;
}

export function squeezed(x: (string | number)[], series: Series[]): Drawn {
  if (x.length <= DRAWN_POINTS) return { x, series, size: 1 };
  const size = Math.ceil(x.length / DRAWN_POINTS);
  const labels: (string | number)[] = [];
  for (let start = 0; start < x.length; start += size) labels.push(x[start]);
  return {
    x: labels,
    size,
    series: series.map((line) => ({ name: line.name, values: labels.map((_, bucket) => average(line.values.slice(bucket * size, bucket * size + size))) })),
  };
}

export function niceTicks(low: number, high: number, count = 5) {
  if (low === high) high = low + 1;
  const raw = (high - low) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((times) => times * magnitude).find((size) => (high - low) / size <= count) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let value = Math.floor(low / step) * step; value <= Math.ceil(high / step) * step + step / 2; value += step) {
    ticks.push(Math.round(value * 1e6) / 1e6);
  }
  return { ticks, step };
}

function longest(texts: string[]): number {
  return texts.reduce((most, text) => Math.max(most, text.length), 0);
}

export function clipped(text: string, room: number): string {
  return text.length > room ? text.slice(0, Math.max(1, room - 1)) + '\u2026' : text;
}

function arcPath(center: number, outer: number, inner: number, from: number, to: number): string {
  const point = (angle: number, radius: number) => r1(center + radius * Math.cos(angle)) + ' ' + r1(center + radius * Math.sin(angle));
  const large = to - from > Math.PI ? 1 : 0;
  return 'M' + point(from, outer) + 'A' + outer + ' ' + outer + ' 0 ' + large + ' 1 ' + point(to, outer) + 'L' + point(to, inner) + 'A' + inner + ' ' + inner + ' 0 ' + large + ' 0 ' + point(from, inner) + 'Z';
}

function ringPath(center: number, outer: number, inner: number): string {
  const circle = (radius: number, sweep: number) =>
    'M' + r1(center - radius) + ' ' + center + 'A' + radius + ' ' + radius + ' 0 1 ' + sweep + ' ' + r1(center + radius) + ' ' + center + 'A' + radius + ' ' + radius + ' 0 1 ' + sweep + ' ' + r1(center - radius) + ' ' + center + 'Z';
  return circle(outer, 1) + circle(inner, 0);
}

function areaPath(points: Point[]): string {
  let path = '';
  let run: NonNullable<Point>[] = [];
  const close = () => {
    if (run.length) {
      path += linePath(run) + run.slice().reverse().map((point) => 'L' + r1(point.x) + ' ' + r1(point.low)).join('') + 'Z';
    }
    run = [];
  };
  for (const point of points) {
    if (point) run.push(point);
    else close();
  }
  close();
  return path;
}

export function placesOf(block: ChartBlock): number {
  return block.decimals ?? decimalsOf(block.series.flatMap((line) => line.values));
}

export function drawnOf(block: ChartBlock): Drawn {
  const labels = block.x ?? block.series[0].values.map((_, position) => position + 1);
  return ['donut', 'gauge', 'funnel', 'heatmap'].includes(block.chart) ? { x: labels, series: block.series, size: 1 } : squeezed(labels, block.series);
}

function percent(numbers: Numbers, share: number): string {
  const rounded = Math.round(share * 1000) / 10;
  return numbers.number(rounded, Number.isInteger(rounded) ? 0 : 1) + '%';
}

export function figureOf(block: ChartBlock, drawn: Drawn, width: number, numbers: Numbers, words: Words): Figure {
  const places = placesOf(block);
  const number = (value: number) => numbers.number(value, places, false);
  const unitText = (value: number) => withUnit(number(value), block.unit);
  switch (block.chart) {
    case 'donut':
      return donut(drawn, width, number, unitText, numbers);
    case 'gauge':
      return gauges(drawn, block.max, unitText, words);
    case 'funnel':
      return funnel(drawn, width, number, numbers, words);
    case 'heatmap':
      return heatmap(drawn, width, number);
    case 'spark': {
      const drawnWidth = Math.min(width, 360);
      const shape = sparkShape(drawn.series[0].values, drawnWidth, 56);
      return { kind: 'spark', width: drawnWidth, height: 56, d: shape.d, end: shape.end, said: sparkText(numbers, block.series[0].values, places) };
    }
    default:
      return cartesian(block.chart, drawn, width, numbers);
  }
}

function tickText(numbers: Numbers, value: number, step: number, reach: number): string {
  if (reach >= 100000) return numbers.human(value);
  return numbers.number(value, step < 1 ? Math.min(6, Math.ceil(-Math.log10(step))) : 0);
}

function cartesian(kind: ChartKind, drawn: Drawn, width: number, numbers: Numbers): Cartesian {
  const { x, series } = drawn;
  const count = x.length;
  const bars = BARS.includes(kind);
  const stacked = STACKED.includes(kind);
  const height = width < 480 ? 200 : 240;
  let low = 0;
  let high = 0;
  if (stacked) {
    for (let position = 0; position < count; position++) {
      let sum = 0;
      for (const line of series) sum += line.values[position] ?? 0;
      high = Math.max(high, sum);
    }
  } else {
    for (const line of series) {
      for (const value of line.values) {
        if (isNumber(value)) {
          low = Math.min(low, value);
          high = Math.max(high, value);
        }
      }
    }
  }
  const { ticks, step } = niceTicks(low, high);
  const floor = ticks[0];
  const ceiling = ticks[ticks.length - 1];
  const reach = Math.max(Math.abs(low), Math.abs(high));
  const tickTexts = ticks.map((value) => tickText(numbers, value, step, reach));
  const left = Math.min(96, Math.max(28, longest(tickTexts) * CHAR + 10));
  const top = 12;
  const plotWidth = Math.max(40, width - left - 12);
  const plotHeight = height - top - 26;
  const y = (value: number) => top + plotHeight * (1 - (value - floor) / (ceiling - floor));
  const band = plotWidth / count;
  const at = bars ? (position: number) => left + band * (position + 0.5) : (position: number) => left + (count === 1 ? plotWidth / 2 : (plotWidth * position) / (count - 1));
  const labels = x.map(String);
  const room = Math.min(120, longest(labels) * CHAR + 10);
  const every = Math.max(1, Math.ceil(count / Math.max(1, Math.floor(plotWidth / room))));
  const fits = Math.max(3, Math.floor(plotWidth / Math.ceil(count / every) / CHAR) - 1);
  const figure: Cartesian = {
    kind: 'cartesian',
    width,
    height,
    left,
    right: width - 12,
    base: r1(top + plotHeight),
    grid: ticks.map((value, position) => ({ key: position, y: r1(y(value)), text: tickTexts[position], zero: value === 0 })),
    labels: [],
    bars: [],
    paths: [],
    areas: [],
    dots: [],
  };
  for (let position = 0; position < count; position += every) {
    figure.labels.push({ key: position, x: r1(at(position)), text: clipped(labels[position], fits) });
  }
  const zero = y(Math.min(Math.max(0, floor), ceiling));
  const stack = new Array<number>(count).fill(0);
  if (bars) {
    const inner = band * 0.72;
    const dense = count > DENSE;
    series.forEach((line, index) => {
      const slot = stacked ? inner : inner / series.length;
      const drawnWidth = r1(Math.max(0.5, slot - (stacked || dense ? 0 : 1)));
      let path = '';
      line.values.forEach((value, position) => {
        if (!isNumber(value)) return;
        let from: number;
        let to: number;
        let start: number;
        if (stacked) {
          start = at(position) - inner / 2;
          from = y(stack[position] + value);
          to = y(stack[position]);
          stack[position] += value;
        } else {
          start = at(position) - inner / 2 + index * slot;
          from = y(Math.max(0, value));
          to = y(Math.min(0, value));
        }
        if (dense) {
          path += 'M' + r1(start) + ' ' + r1(from) + 'h' + drawnWidth + 'V' + r1(to) + 'h' + -drawnWidth + 'Z';
        } else {
          figure.bars.push({ key: index * count + position, series: index, x: r1(start), y: r1(from), width: drawnWidth, height: r1(Math.max(0.5, to - from)) });
        }
      });
      if (dense) figure.paths.push({ key: 'b' + index, series: index, d: path, line: false });
    });
    return figure;
  }
  series.forEach((line, index) => {
    const points: Point[] = line.values.map((value, position) => {
      if (kind === 'stacked_area') {
        const under = stack[position];
        stack[position] += value ?? 0;
        return { x: at(position), y: y(stack[position]), low: y(under) };
      }
      return isNumber(value) ? { x: at(position), y: y(value), low: zero } : null;
    });
    if (kind !== 'line') figure.areas.push({ key: index, series: index, d: areaPath(points) });
    figure.paths.push({ key: 'l' + index, series: index, d: linePath(points), line: true });
    if (count <= DOTTED) {
      points.forEach((point, position) => {
        if (point && isNumber(line.values[position])) figure.dots.push({ key: index * count + position, series: index, x: r1(point.x), y: r1(point.y) });
      });
    }
  });
  return figure;
}

function donut(drawn: Drawn, width: number, number: (value: number) => string, unitText: (value: number) => string, numbers: Numbers): Donut {
  const values = drawn.series[0].values as number[];
  const labels = drawn.x.map(String);
  const size = Math.min(200, width);
  const center = size / 2;
  const outer = center - 2;
  const inner = outer - Math.max(18, Math.round(size * 0.14));
  const total = values.reduce((sum, value) => sum + value, 0);
  const parts = values.filter((value) => value > 0).length;
  const gap = parts > 1 ? 0.012 : 0;
  let angle = -Math.PI / 2;
  const slices: Donut['slices'] = [];
  const legend: Donut['legend'] = [];
  values.forEach((value, position) => {
    legend.push({ key: position, series: position, label: labels[position], value: number(value), share: percent(numbers, value / total) });
    if (value <= 0) return;
    const sweep = (value / total) * TWO_PI;
    slices.push({ key: position, series: position, d: sweep >= TWO_PI - 1e-9 ? ringPath(center, outer, inner) : arcPath(center, outer, inner, angle, angle + sweep - gap) });
    angle += sweep;
  });
  return { kind: 'donut', size, slices, legend, total: unitText(total) };
}

function gauges(drawn: Drawn, max: number, unitText: (value: number) => string, words: Words): Gauges {
  const radius = 66;
  const middle = 90;
  const floor = 84;
  const point = (share: number) => r1(middle - radius * Math.cos(Math.PI * share)) + ' ' + r1(floor - radius * Math.sin(Math.PI * share));
  return {
    kind: 'gauge',
    gauges: drawn.series.map((line, position) => {
      const value = line.values[0] as number;
      const share = Math.min(1, Math.max(0, value / max));
      return {
        key: position,
        series: position,
        track: 'M' + point(0) + 'A' + radius + ' ' + radius + ' 0 0 1 ' + point(1),
        arc: share > 0 ? 'M' + point(0) + 'A' + radius + ' ' + radius + ' 0 0 1 ' + point(share) : '',
        value: unitText(value),
        label: line.name,
        max: words.of(unitText(max)),
      };
    }),
  };
}

function funnel(drawn: Drawn, width: number, number: (value: number) => string, numbers: Numbers, words: Words): Funnel {
  const values = drawn.series[0].values as number[];
  const labels = drawn.x.map(String);
  const labelWidth = Math.min(180, Math.max(96, Math.round(width * 0.38)));
  const area = Math.max(40, width - labelWidth - 8);
  const most = Math.max(...values) || 1;
  const room = Math.floor((labelWidth - 6) / CHAR);
  const rows = values.map((value, position) => {
    const drawnWidth = Math.max(3, (area * value) / most);
    const before = values[position - 1];
    const detail = position && before ? words.stepBefore(number(value), percent(numbers, value / before)) : number(value);
    return { key: position, top: position * 42, label: clipped(labels[position], room), detail: clipped(detail, room + 8), x: r1(labelWidth + 8 + (area - drawnWidth) / 2), width: r1(drawnWidth) };
  });
  return { kind: 'funnel', width, height: values.length * 42 - 6, labelWidth, rows };
}

function heatmap(drawn: Drawn, width: number, number: (value: number) => string): Heatmap {
  const rows = drawn.series;
  const columns = drawn.x.map(String);
  let low = Infinity;
  let high = -Infinity;
  for (const line of rows) {
    for (const value of line.values) {
      if (isNumber(value)) {
        low = Math.min(low, value);
        high = Math.max(high, value);
      }
    }
  }
  const span = high - low;
  const left = Math.min(140, Math.max(40, longest(rows.map((line) => line.name)) * CHAR + 10));
  const gap = 3;
  const cell = Math.min(46, Math.max(14, Math.floor((width - left) / columns.length) - gap));
  const pitch = cell + gap;
  const head = 22;
  const every = Math.max(1, Math.ceil((Math.min(longest(columns), 8) * CHAR + 6) / pitch));
  const figure: Heatmap = {
    kind: 'heatmap',
    width: left + columns.length * pitch,
    height: head + rows.length * pitch,
    cell,
    cells: [],
    rowLabels: rows.map((line, index) => ({ key: index, y: r1(head + index * pitch + cell / 2 + 4), text: clipped(line.name, Math.floor((left - 8) / CHAR)) })),
    columnLabels: [],
    low: Number.isFinite(low) ? number(low) : '',
    high: Number.isFinite(high) ? number(high) : '',
  };
  for (let position = 0; position < columns.length; position += every) {
    figure.columnLabels.push({ key: position, x: r1(left + position * pitch + cell / 2), text: clipped(columns[position], 8) });
  }
  const room = Math.floor((cell - 4) / 6.5);
  rows.forEach((line, index) => {
    line.values.forEach((value, position) => {
      const known = isNumber(value);
      const level = known ? (span ? Math.round(((value - low) / span) * 5) : 3) : 0;
      const text = known ? number(value) : '';
      figure.cells.push({ key: index * columns.length + position, x: left + position * pitch, y: head + index * pitch, level, known, text: cell >= 26 && text.length <= room ? text : '' });
    });
  });
  return figure;
}

export function chartColumns(block: ChartBlock, words: { name: string; value: string; max: string; label: string }) {
  const style = { unit: block.unit, decimals: block.decimals };
  const number = (name: string | number) => ({ name: String(name).slice(0, 60), kind: 'number' as const, total: false, tones: null, ...style });
  const text = (name: string) => ({ name, kind: 'text' as const, unit: '', decimals: null, total: false, tones: null });
  if (block.chart === 'gauge') {
    return { columns: [text(block.xLabel || words.name), number(words.value), number(words.max)], rows: block.series.map((line) => [line.name, line.values[0], block.max]) };
  }
  if (block.chart === 'heatmap') {
    return { columns: [text(block.xLabel || ' '), ...(block.x ?? []).map(number)], rows: block.series.map((line) => [line.name, ...line.values]) };
  }
  const labels = block.x ?? block.series[0].values.map((_, position) => position + 1);
  return {
    columns: [text(block.xLabel || words.label), ...block.series.map((line) => number(line.name))],
    rows: labels.map((label, position) => [String(label), ...block.series.map((line) => line.values[position])]),
  };
}
