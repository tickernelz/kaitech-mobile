import type { DailyMessage } from '../discovery/api';
import type { ActivityType } from './odoo';

export function orderedTypes(types: ActivityType[], previousTypeId: number | null): ActivityType[] {
  const suggested = types.find((type) => type.id === previousTypeId)?.suggested ?? [];
  if (!suggested.length) return types;
  return [...types.filter((type) => suggested.includes(type.id)), ...types.filter((type) => !suggested.includes(type.id))];
}

export function offersDaily(daily: DailyMessage): 'toggle' | 'link' | null {
  if (!daily.channel) return null;
  if (daily.reaches || daily.on) return 'toggle';
  return 'link';
}

export function monthCells(year: number, month: number, weekStartsOn: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStartsOn + 7) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7) cells.push(null);
  return cells;
}
