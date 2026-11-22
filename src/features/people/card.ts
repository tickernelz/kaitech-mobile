import type { Account } from '../../auth/oauth';
import { route, rpc } from '../../api/odoo';

export type Presence = 'online' | 'away' | 'busy' | 'offline';

export type PersonCard = {
  partnerId: number;
  name: string;
  email: string;
  phone: string;
  presence: Presence;
  external: boolean;
  status: string;
  title: string;
  company: string;
};

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function presenceOf(value: unknown): Presence {
  const raw = text(value);
  if (raw.startsWith('online')) return 'online';
  if (raw.startsWith('away')) return 'away';
  if (raw.startsWith('busy')) return 'busy';
  return 'offline';
}

function rowsOf(store: Record<string, unknown> | undefined, model: string): Record<string, unknown>[] {
  const value = store?.[model];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  return value && typeof value === 'object' ? [value as Record<string, unknown>] : [];
}

export function cardFrom(store: Record<string, unknown> | undefined, partnerId: number): Omit<PersonCard, 'status' | 'title' | 'company'> | null {
  const row = rowsOf(store, 'res.partner').find((partner) => partner.id === partnerId);
  if (!row) return null;
  return {
    partnerId,
    name: text(row.name),
    email: text(row.email),
    phone: text(row.phone),
    presence: presenceOf(row.im_status),
    external: row.partner_share === true,
  };
}

export async function personCard(account: Account, partnerId: number): Promise<PersonCard | null> {
  const [store, details] = await Promise.all([
    route<Record<string, unknown>>(account, '/mail/data', { fetch_params: [['avatar_card', { id: partnerId, model: 'res.partner' }]] }),
    rpc<Record<string, unknown>[]>(account, 'res.partner', 'read', [[partnerId], ['function', 'parent_name', 'user_ids']]).catch(() => []),
  ]);
  const card = cardFrom(store, partnerId);
  if (!card) return null;
  const detail = details[0] ?? {};
  const userIds = Array.isArray(detail.user_ids) ? (detail.user_ids as unknown[]).filter((id): id is number => typeof id === 'number') : [];
  const users = userIds.length
    ? await rpc<Record<string, unknown>[]>(account, 'res.users', 'read', [[userIds[0]], ['kaitech_status_text']]).catch(() => [])
    : [];
  return { ...card, status: text(users[0]?.kaitech_status_text), title: text(detail.function), company: text(detail.parent_name) };
}

export async function chatWith(account: Account, partnerId: number): Promise<number> {
  const store = await route<Record<string, unknown>>(account, '/mail/action', { fetch_params: [['/discuss/get_or_create_chat', { partners_to: [partnerId] }, 1]] });
  const response = rowsOf(store, 'DataResponse').find((row) => row.id === 1);
  const channel = response?.channel;
  if (typeof channel === 'number') return channel;
  if (channel && typeof channel === 'object' && typeof (channel as { id?: unknown }).id === 'number') return (channel as { id: number }).id;
  throw new Error('chat_missing');
}
