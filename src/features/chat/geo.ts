export type Point = { latitude: number; longitude: number };
export type Tile = { key: string; z: number; x: number; y: number; left: number; top: number };

export const tileSize = 256;
export const minZoom = 3;
export const maxZoom = 19;
const maxLatitude = 85.05112878;

export function clampZoom(zoom: number): number {
  return Math.min(maxZoom, Math.max(minZoom, Math.round(zoom)));
}

export function worldSize(zoom: number): number {
  return tileSize * 2 ** zoom;
}

export function toWorld(point: Point, zoom: number): { x: number; y: number } {
  const size = worldSize(zoom);
  const latitude = Math.min(maxLatitude, Math.max(-maxLatitude, point.latitude));
  const sin = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((point.longitude + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

export function fromWorld(x: number, y: number, zoom: number): Point {
  const size = worldSize(zoom);
  const wrapped = ((x % size) + size) % size;
  const clampedY = Math.min(size, Math.max(0, y));
  const n = Math.PI - (2 * Math.PI * clampedY) / size;
  return { latitude: (180 / Math.PI) * Math.atan(Math.sinh(n)), longitude: (wrapped / size) * 360 - 180 };
}

export function moved(center: Point, zoom: number, dx: number, dy: number): Point {
  const world = toWorld(center, zoom);
  return fromWorld(world.x - dx, world.y - dy, zoom);
}

export function offsetOf(center: Point, zoom: number, point: Point): { dx: number; dy: number } {
  const a = toWorld(center, zoom);
  const b = toWorld(point, zoom);
  const size = worldSize(zoom);
  let dx = b.x - a.x;
  if (dx > size / 2) dx -= size;
  if (dx < -size / 2) dx += size;
  return { dx, dy: b.y - a.y };
}

export function tilesFor(center: Point, zoom: number, width: number, height: number, margin = 1): Tile[] {
  if (width <= 0 || height <= 0) return [];
  const world = toWorld(center, zoom);
  const count = 2 ** zoom;
  const left = world.x - width / 2;
  const top = world.y - height / 2;
  const firstX = Math.floor(left / tileSize) - margin;
  const lastX = Math.floor((left + width) / tileSize) + margin;
  const firstY = Math.max(0, Math.floor(top / tileSize) - margin);
  const lastY = Math.min(count - 1, Math.floor((top + height) / tileSize) + margin);
  const tiles: Tile[] = [];
  for (let ty = firstY; ty <= lastY; ty += 1) {
    for (let tx = firstX; tx <= lastX; tx += 1) {
      const x = ((tx % count) + count) % count;
      tiles.push({ key: `${zoom}/${tx}/${ty}`, z: zoom, x, y: ty, left: tx * tileSize - left, top: ty * tileSize - top });
    }
  }
  return tiles;
}

export function tilePath(tile: Pick<Tile, 'z' | 'x' | 'y'>): string {
  return `/kaitech_chat/map/tile/${tile.z}/${tile.x}/${tile.y}.png`;
}

export function distanceMeters(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function zoomForAccuracy(meters: number | null): number {
  if (meters === null || meters <= 30) return 17;
  if (meters <= 100) return 16;
  if (meters <= 500) return 15;
  if (meters <= 2000) return 13;
  return 12;
}

export function mapsAppUrl(point: Point & { name?: string }, platform: 'ios' | 'android' | string): string {
  const at = `${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`;
  const label = point.name ? encodeURIComponent(point.name) : '';
  if (platform === 'ios') return `https://maps.apple.com/?ll=${at}&q=${label || at}`;
  return `geo:${at}?q=${at}${label ? `(${label})` : ''}`;
}

export function formatCoordinates(point: Point): string {
  return `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
}
