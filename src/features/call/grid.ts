export type Stage = { columns: number; rows: number; perPage: number; tileWidth: number; tileHeight: number };

export type CallLayout = { pip: boolean; controls: 'bar' | 'rail'; people: 'side' | 'sheet' };

export const tileGap = 8;
const pipMaxSide = 240;
const railMaxHeight = 480;
const narrowPhoneWidth = 400;
const sidePanelMinWidth = 840;

function shape(count: number, landscape: boolean, width: number): [number, number] {
  if (count <= 1) return [1, 1];
  if (count === 2) return landscape ? [2, 1] : [1, 2];
  if (count <= 4) return [2, 2];
  if (count <= 6) return landscape ? [3, 2] : [2, 3];
  if (!landscape && width < narrowPhoneWidth) return [2, 3];
  return [3, 3];
}

export function stageFor(count: number, width: number, height: number): Stage {
  const [columns, rows] = shape(count, width > height, width);
  return {
    columns,
    rows,
    perPage: columns * rows,
    tileWidth: Math.max(0, Math.floor((width - tileGap * (columns - 1)) / columns)),
    tileHeight: Math.max(0, Math.floor((height - tileGap * (rows - 1)) / rows)),
  };
}

export function pagesFor(ids: string[], speaking: string[], perPage: number): string[][] {
  if (perPage < 1) return [];
  const order = [...ids];
  if (order.length > perPage) {
    const speaker = speaking.find((id) => order.indexOf(id) >= perPage);
    if (speaker) {
      const from = order.indexOf(speaker);
      const to = perPage - 1;
      [order[from], order[to]] = [order[to], order[from]];
    }
  }
  const pages: string[][] = [];
  for (let start = 0; start < order.length; start += perPage) pages.push(order.slice(start, start + perPage));
  return pages;
}

export function presenterOf<T extends { local: boolean; screenOn: boolean }>(people: T[]): T | null {
  return people.find((person) => person.screenOn && !person.local) ?? people.find((person) => person.screenOn) ?? null;
}

type Seat = { local: boolean; cameraOn: boolean; screenOn: boolean };

export type StageView<T> = {
  onStage: boolean;
  kind: 'screen' | 'focus' | 'grid' | 'avatar';
  big: T | null;
  small: T | null;
  face: T | null;
};

export function stageView<T extends Seat>(input: { people: T[]; presenter: T | null; spotted: T | null; swapped: boolean }): StageView<T> {
  const self = input.people.find((person) => person.local) ?? null;
  const remote = input.people.filter((person) => !person.local);
  const anyVideo = input.people.some((person) => person.cameraOn || person.screenOn);
  const duo = anyVideo && self !== null && remote.length === 1;
  const big = input.spotted ?? (duo ? (input.swapped ? self : remote[0]) : remote.length === 0 && self?.cameraOn ? self : null);
  const small = duo ? (input.swapped ? remote[0] : self) : null;
  const kind = input.presenter ? 'screen' : big ? 'focus' : input.people.length > 2 ? 'grid' : 'avatar';
  return { onStage: anyVideo || input.presenter !== null, kind, big, small, face: remote[0] ?? null };
}

export function layoutFor(width: number, height: number): CallLayout {
  return {
    pip: Math.min(width, height) > 0 && Math.min(width, height) < pipMaxSide,
    controls: width > height && height < railMaxHeight ? 'rail' : 'bar',
    people: width >= sidePanelMinWidth ? 'side' : 'sheet',
  };
}
