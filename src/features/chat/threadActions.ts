import { route, rpc } from '../../api/odoo';
import { forgetConversation, getChat, patchInfo, refreshConversations, setFeatures } from './chat';
import { run, type Person } from './messageActions';
import { attachmentFromStore, messagesFromStore, type Notifications } from './odoo';
import type { Attachment, Message } from './types';

export type Member = Person & { memberId: number; role: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function list(data: unknown, model: string): Record<string, unknown>[] {
  if (!isRecord(data)) return [];
  const value = data[model];
  return Array.isArray(value) ? value.filter(isRecord) : isRecord(value) ? [value] : [];
}

function idOf(value: unknown): number | null {
  if (typeof value === 'number' && value > 0) return value;
  return isRecord(value) ? idOf(value.id) : null;
}

export function membersOf(channelId: number) {
  return run(async (account): Promise<Member[]> => {
    const data = await route<unknown>(account, '/discuss/channel/members', { channel_id: channelId, known_member_ids: [] });
    const names = new Map(list(data, 'res.partner').map((partner) => [idOf(partner.id), typeof partner.name === 'string' ? partner.name : '']));
    return list(data, 'discuss.channel.member')
      .filter((member) => idOf(member.channel_id) === channelId && idOf(member.partner_id))
      .map((member) => {
        const partnerId = idOf(member.partner_id) ?? 0;
        return { id: partnerId, memberId: idOf(member.id) ?? 0, name: names.get(partnerId) ?? '', role: typeof member.kaitech_chat_role === 'string' ? member.kaitech_chat_role : 'member' };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
}

export function invitable(channelId: number, query: string) {
  return run(async (account): Promise<Person[]> => {
    const raw = await rpc<Record<string, unknown>>(account, 'res.partner', 'search_for_channel_invite', [query], { channel_id: channelId, limit: 20 });
    const ids = Array.isArray(raw?.partner_ids) ? raw.partner_ids.filter((item): item is number => typeof item === 'number') : [];
    const names = new Map(list(raw?.store_data, 'res.partner').map((partner) => [idOf(partner.id), typeof partner.name === 'string' ? partner.name : '']));
    return ids.map((id) => ({ id, name: names.get(id) ?? '' }));
  });
}

export function invite(channelId: number, partnerIds: number[]) {
  return run(async (account) => {
    await rpc(account, 'discuss.channel', 'add_members', [[channelId]], { partner_ids: partnerIds });
  });
}

export function setRole(channelId: number, memberId: number, role: string) {
  return run(async (account) => rpc<string>(account, 'discuss.channel', 'kaitech_chat_set_role', [[channelId], memberId, role]));
}

function channelMessages(data: unknown, channelId: number): Message[] {
  return messagesFromStore(data, getChat().partnerId).filter((message) => message.channelId === channelId);
}

export function pinnedMessages(channelId: number) {
  return run(async (account) => channelMessages(await route<unknown>(account, '/discuss/channel/pinned_messages', { channel_id: channelId }), channelId).reverse());
}

export function searchMessages(channelId: number, term: string) {
  return run(async (account) => {
    const page = await route<Record<string, unknown>>(account, '/discuss/channel/messages', { channel_id: channelId, fetch_params: { search_term: term, limit: 30 } });
    return channelMessages(page?.data, channelId).reverse();
  });
}

export function channelFiles(channelId: number, before: number | null) {
  return run(async (account): Promise<Attachment[]> => {
    const raw = await route<Record<string, unknown>>(account, '/discuss/channel/attachments', { channel_id: channelId, limit: 30, ...(before ? { before } : {}) });
    return attachmentFromStore(raw?.store_data);
  });
}

export function rename(channelId: number, type: string, name: string, description: string | null) {
  return run(async (account) => {
    if (type === 'chat') await rpc(account, 'discuss.channel', 'channel_set_custom_name', [[channelId]], { name });
    else await rpc(account, 'discuss.channel', 'channel_rename', [[channelId]], { name });
    if (description !== null) await rpc(account, 'discuss.channel', 'channel_change_description', [[channelId]], { description });
    patchInfo(channelId, { name, ...(description !== null ? { description } : {}) });
    void refreshConversations();
  });
}

export function setNotifications(channelId: number, value: Notifications) {
  return run(async (account) => {
    await route(account, '/discuss/settings/custom_notifications', { custom_notifications: value ?? false, channel_id: channelId });
    patchInfo(channelId, { notifications: value });
  });
}

export function pinConversation(channelId: number, pinned: boolean) {
  return run(async (account) => {
    await rpc(account, 'discuss.channel', 'kaitech_chat_set_pinned', [[channelId], pinned]);
    patchInfo(channelId, { pinned });
    void refreshConversations();
  });
}

export function setAnnouncement(channelId: number, announcement: boolean) {
  return run(async (account) => {
    await rpc(account, 'discuss.channel', 'kaitech_chat_set_announcement', [[channelId], announcement]);
    patchInfo(channelId, { announcement });
  });
}

export function setAutoTranslate(on: boolean) {
  return run(async (account) => {
    const value = await rpc<boolean>(account, 'res.users', 'kaitech_chat_set_auto_translate', [on]);
    setFeatures({ translateAuto: value === true });
  });
}

export function leave(channelId: number, type: string) {
  return run(async (account) => {
    if (type === 'chat') await rpc(account, 'discuss.channel', 'channel_pin', [[channelId]], { pinned: false });
    else await rpc(account, 'discuss.channel', 'action_unfollow', [[channelId]]);
    forgetConversation(channelId);
  });
}

export function deleteThread(channelId: number) {
  return run(async (account) => {
    await route(account, '/discuss/channel/sub_channel/delete', { sub_channel_id: channelId });
    forgetConversation(channelId);
  });
}

export type Scheduled = { id: number; body: string; date: number; files: number };

function scheduledFrom(data: unknown): Scheduled[] {
  return list(data, 'mail.scheduled.message')
    .map((item) => {
      const date = typeof item.scheduled_date === 'string' ? Date.parse(`${item.scheduled_date.replace(' ', 'T')}Z`) : NaN;
      const body = Array.isArray(item.body) ? String(item.body[1] ?? '') : typeof item.body === 'string' ? item.body : '';
      return { id: idOf(item.id) ?? 0, body, date: Number.isFinite(date) ? date : 0, files: Array.isArray(item.attachment_ids) ? item.attachment_ids.length : 0 };
    })
    .filter((item) => item.id)
    .sort((a, b) => a.date - b.date);
}

export function scheduledMessages(channelId: number) {
  return run(async (account) => scheduledFrom(await rpc<unknown>(account, 'discuss.channel', 'kaitech_chat_scheduled_messages', [[channelId]])));
}

export function sendScheduledNow(id: number) {
  return run(async (account) => {
    await rpc(account, 'mail.scheduled.message', 'post_message', [[id]]);
  });
}

export function cancelScheduled(id: number) {
  return run(async (account) => {
    await rpc(account, 'mail.scheduled.message', 'unlink', [[id]]);
  });
}

export type TakenBack = { body: string; partnerIds: number[] };

export function takeBackScheduled(id: number) {
  return run(async (account): Promise<TakenBack> => {
    const raw = await rpc<Record<string, unknown>>(account, 'mail.scheduled.message', 'kaitech_chat_take_back', [[id]]);
    return { body: typeof raw?.body === 'string' ? raw.body : Array.isArray(raw?.body) ? String(raw.body[1] ?? '') : '', partnerIds: Array.isArray(raw?.partner_ids) ? raw.partner_ids.filter((item): item is number => typeof item === 'number') : [] };
  });
}

export type Translation = { body: string; lang: string };

export function translationsFor(messageIds: number[]) {
  return run(async (account) => {
    const raw = await route<Record<string, unknown>>(account, '/kaitech_chat/message/translations', { message_ids: messageIds });
    const found = isRecord(raw?.translations) ? raw.translations : {};
    const out = new Map<number, Translation>();
    for (const [key, value] of Object.entries(found)) {
      if (isRecord(value) && typeof value.body === 'string') out.set(Number(key), { body: value.body, lang: typeof value.lang_name === 'string' ? value.lang_name : '' });
    }
    return { found: out, busy: Array.isArray(raw?.busy) ? raw.busy.filter((item): item is number => typeof item === 'number') : [] };
  });
}
