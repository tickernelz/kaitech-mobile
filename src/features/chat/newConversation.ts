import { route, rpc } from '../../api/odoo';
import { refreshConversations } from './chat';
import { run, type Person } from './messageActions';

export function channelOf(data: unknown): number {
  const responses = (data as { DataResponse?: unknown } | null)?.DataResponse;
  const list = Array.isArray(responses) ? responses : responses ? [responses] : [];
  for (const item of list) {
    const channel = (item as { channel?: { id?: unknown } | number })?.channel;
    const id = typeof channel === 'number' ? channel : channel?.id;
    if (typeof id === 'number' && id > 0) return id;
  }
  throw new Error('no channel');
}

export function searchPeople(query: string) {
  return run(async (account): Promise<Person[]> => {
    const rows = await rpc<{ id: number; name: string }[]>(account, 'res.partner', 'search_read', [[['name', 'ilike', query], ['user_ids.share', '=', false], ['user_ids.active', '=', true]]], { fields: ['name'], limit: 20, order: 'name' });
    return (rows ?? []).map((row) => ({ id: row.id, name: row.name ?? '' }));
  });
}

export function startChat(partnerIds: number[], myPartnerId: number) {
  return run(async (account) => {
    const others = partnerIds.filter((id) => id !== myPartnerId);
    const data =
      others.length <= 1
        ? await route<unknown>(account, '/mail/action', { fetch_params: [['/discuss/get_or_create_chat', { partners_to: others.length ? others : [myPartnerId] }, 1]] })
        : await route<unknown>(account, '/mail/action', { fetch_params: [['/discuss/create_group', { partners_to: [myPartnerId, ...others] }, 1]] });
    const id = channelOf(data);
    void refreshConversations();
    return id;
  });
}

export function createChannel(input: { name: string; groupId: number | null; partnerIds: number[]; announcement: boolean }) {
  return run(async (account) => {
    const data = await route<unknown>(account, '/mail/action', { fetch_params: [['/discuss/create_channel', { name: input.name, group_id: input.groupId ?? false }, 1]] });
    const id = channelOf(data);
    const problems: string[] = [];
    if (input.announcement) await rpc(account, 'discuss.channel', 'kaitech_chat_set_announcement', [[id], true]).catch(() => problems.push('announcement'));
    if (input.partnerIds.length) await rpc(account, 'discuss.channel', 'add_members', [[id]], { partner_ids: input.partnerIds }).catch(() => problems.push('members'));
    void refreshConversations();
    return { id, problems };
  });
}
