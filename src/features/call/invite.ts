import type { Account } from '../../auth/oauth';
import { rpc } from '../../api/odoo';

export type Invitee = { partnerId: number; name: string };

export function inviteesFrom(answer: unknown): Invitee[] {
  const body = (answer ?? {}) as { partner_ids?: unknown; store_data?: Record<string, unknown> };
  const ids = Array.isArray(body.partner_ids) ? body.partner_ids.filter((id): id is number => typeof id === 'number') : [];
  const raw = body.store_data?.['res.partner'];
  const rows = (Array.isArray(raw) ? raw : raw ? [raw] : []) as Record<string, unknown>[];
  const names = new Map(rows.filter((row) => typeof row.id === 'number').map((row) => [row.id as number, typeof row.name === 'string' ? row.name : '']));
  return ids.map((partnerId) => ({ partnerId, name: names.get(partnerId) ?? '' }));
}

export async function searchInvitees(account: Account, term: string, channelId: number): Promise<Invitee[]> {
  return inviteesFrom(await rpc<unknown>(account, 'res.partner', 'search_for_channel_invite', [term, channelId]));
}

export function inviteToCall(account: Account, channelId: number, partnerIds: number[]) {
  return rpc<unknown>(account, 'discuss.channel', 'add_members', [[channelId]], { partner_ids: partnerIds, invite_to_rtc_call: true });
}
