import type { Account } from '../../auth/oauth';
import { route, rpc } from '../../api/odoo';

export type PersonHit = { partnerId: number; name: string; email: string };
export type ChannelHit = { id: number; name: string; type: string; member: boolean };
export type DirectoryHits = { people: PersonHit[]; channels: ChannelHit[] };

function rows(store: Record<string, unknown> | undefined, model: string): Record<string, unknown>[] {
  const value = store?.[model];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  return value && typeof value === 'object' ? [value as Record<string, unknown>] : [];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function directoryFrom(store: Record<string, unknown> | undefined, myPartnerId: number): DirectoryHits {
  const channels = rows(store, 'discuss.channel')
    .filter((row) => typeof row.id === 'number' && row.channel_type !== 'chat')
    .map((row) => ({ id: row.id as number, name: text(row.name), type: text(row.channel_type) || 'channel', member: Boolean(row.self_member_id) || row.is_member === true }));
  const people = rows(store, 'res.partner')
    .filter((row) => typeof row.id === 'number' && row.id !== myPartnerId && text(row.name))
    .map((row) => ({ partnerId: row.id as number, name: text(row.name), email: text(row.email) }));
  return { people, channels };
}

export async function searchDirectory(account: Account, term: string): Promise<DirectoryHits> {
  return directoryFrom(await route<Record<string, unknown>>(account, '/discuss/search', { term, limit: 20 }), account.partnerId);
}

export function joinChannel(account: Account, channelId: number) {
  return rpc<unknown>(account, 'discuss.channel', 'add_members', [[channelId]], { partner_ids: [account.partnerId] });
}

export const previewCount = 5;

export function preview<T>(items: T[], showAll: boolean): { shown: T[]; more: number } {
  if (showAll || items.length <= previewCount) return { shown: items, more: 0 };
  return { shown: items.slice(0, previewCount), more: items.length - previewCount };
}
