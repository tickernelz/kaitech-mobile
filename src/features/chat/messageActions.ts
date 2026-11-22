import { ApiError, route, rpc } from '../../api/odoo';
import { AppError } from '../../auth/errors';
import type { Account } from '../../auth/oauth';
import { chatClient, patchMessages, refreshConversations } from './chat';
import { composeBody, mentionsInText, type ComposedMention } from './html';
import { messagePatches } from './odoo';
import { noteStarToggled } from './starredCount';
import type { Message } from './types';

export type Failure = { code: string; detail: string | null };
export type Result<T> = { ok: true; value: T } | ({ ok: false } & Failure);

export type Person = { id: number; name: string };

function failureOf(error: unknown): Failure {
  if (error instanceof ApiError) return { code: error.code, detail: error.detail };
  if (error instanceof AppError) return { code: error.code, detail: null };
  return { code: 'unknown', detail: null };
}

export async function run<T>(work: (account: Account) => Promise<T>): Promise<Result<T>> {
  const account = chatClient()?.account;
  if (!account) return { ok: false, code: 'signedOut', detail: null };
  try {
    return { ok: true, value: await work(account) };
  } catch (error) {
    return { ok: false, ...failureOf(error) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function people(value: unknown): Person[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (isRecord(item) && typeof item.id === 'number' ? [{ id: item.id, name: typeof item.name === 'string' ? item.name : '' }] : []));
}

function pairs(value: unknown): Person[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => (Array.isArray(item) && typeof item[0] === 'number' ? [{ id: item[0], name: typeof item[1] === 'string' ? item[1] : '' }] : []));
}

export function odooDatetime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

export function odooDate(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fromOdooDatetime(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(`${value.replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function mentionsInBody(html: string): ComposedMention[] {
  const found = new Map<number, ComposedMention>();
  for (const match of html.matchAll(/<a\b[^>]*data-oe-model="res\.partner"[^>]*>([^<]*)<\/a>/g)) {
    const id = /data-oe-id="(\d+)"/.exec(match[0]);
    const name = match[1].replace(/^@/, '').trim();
    if (id && name) found.set(Number(id[1]), { id: Number(id[1]), name });
  }
  return [...found.values()];
}

export function editMessage(message: Message, text: string, mentions: ComposedMention[]) {
  const used = mentionsInText(text, mentions);
  return run(async (account) => {
    const data = await route<unknown>(account, '/mail/message/update_content', {
      message_id: message.id,
      update_data: { body: composeBody(text, used), partner_ids: used.map((mention) => mention.id) },
    });
    patchMessages(messagePatches(data));
  });
}

export function removeMessage(message: Message) {
  return run(async (account) => {
    const data = await route<unknown>(account, '/mail/message/update_content', {
      message_id: message.id,
      update_data: { body: '', attachment_ids: [], attachment_tokens: [] },
    });
    patchMessages(messagePatches(data));
  });
}

export function setPinned(message: Message, pinned: boolean) {
  return run(async (account) => {
    await rpc(account, 'discuss.channel', 'set_message_pin', [[message.channelId]], { message_id: message.id, pinned });
    patchMessages(new Map([[message.id, { pinnedAt: pinned ? odooDatetime(Date.now()) : null }]]));
  });
}

export function toggleStar(message: Message) {
  return run(async (account) => {
    const data = await rpc<unknown>(account, 'mail.message', 'toggle_message_starred', [[message.id]]);
    const patches = messagePatches(data);
    patchMessages(patches.size ? patches : new Map([[message.id, { starred: !message.starred }]]));
    noteStarToggled(!message.starred);
  });
}

export function toggleTranslation(message: Message) {
  return run(async (account) => {
    if (message.translated) {
      patchMessages(new Map([[message.id, { translated: false }]]));
      return false;
    }
    if (message.translation) {
      patchMessages(new Map([[message.id, { translated: true }]]));
      return true;
    }
    const raw = await route<Record<string, unknown> | null>(account, '/mail/message/translate', { message_id: message.id });
    const body = typeof raw?.body === 'string' ? raw.body : '';
    if (!body) return false;
    patchMessages(new Map([[message.id, { translation: { body, lang: typeof raw?.lang_name === 'string' ? raw.lang_name : '' }, translated: true }]]));
    return true;
  });
}

export function markUnreadFrom(message: Message) {
  return run(async (account) => {
    await route(account, '/discuss/channel/set_new_message_separator', { channel_id: message.channelId, message_id: message.id });
    void refreshConversations();
  });
}

export type ForwardSource = { id: number; author: string; date: number | null; preview: string; files: number };
export type ForwardTarget = { id: number; name: string; kind: string };
export type ForwardDraft = { messageId: number; limit: number; messages: ForwardSource[]; targets: ForwardTarget[] };

export function forwardDraft(messageId: number) {
  return run(async (account): Promise<ForwardDraft> => {
    const raw = await rpc<Record<string, unknown>>(account, 'discuss.channel', 'kaitech_chat_forward_draft', [messageId]);
    const messages = Array.isArray(raw?.messages) ? raw.messages.filter(isRecord) : [];
    const targets = Array.isArray(raw?.targets) ? raw.targets.filter(isRecord) : [];
    return {
      messageId: typeof raw?.message_id === 'number' ? raw.message_id : messageId,
      limit: typeof raw?.limit === 'number' ? raw.limit : 50,
      messages: messages.map((item) => ({
        id: Number(item.id),
        author: typeof item.author === 'string' ? item.author : '',
        date: fromOdooDatetime(item.date),
        preview: typeof item.preview === 'string' ? item.preview : '',
        files: typeof item.files === 'number' ? item.files : 0,
      })),
      targets: targets.map((item) => ({ id: Number(item.id), name: typeof item.name === 'string' ? item.name : '', kind: typeof item.kind === 'string' ? item.kind : 'channel' })),
    };
  });
}

export function forwardTo(targetId: number, messageIds: number[]) {
  return run(async (account) => {
    const raw = await rpc<Record<string, unknown>>(account, 'discuss.channel', 'kaitech_chat_forward', [[targetId], messageIds]);
    return { channelId: typeof raw?.channel_id === 'number' ? raw.channel_id : targetId, count: typeof raw?.count === 'number' ? raw.count : messageIds.length };
  });
}

export type Readers = { read: number; total: number; readers: Person[]; notYet: Person[]; hidden: number };

export function readersOfMessage(channelId: number, messageId: number) {
  return run(async (account): Promise<Readers> => {
    const raw = await rpc<Record<string, unknown>>(account, 'discuss.channel', 'kaitech_chat_readers', [[channelId], messageId]);
    return {
      read: typeof raw?.read === 'number' ? raw.read : 0,
      total: typeof raw?.total === 'number' ? raw.total : 0,
      readers: people(raw?.readers),
      notYet: people(raw?.not_yet),
      hidden: typeof raw?.hidden === 'number' ? raw.hidden : 0,
    };
  });
}

export function searchProjects(query: string) {
  return run(async (account) => pairs(await rpc(account, 'project.project', 'name_search', [], { name: query, limit: 20 })));
}

export function searchUsers(query: string) {
  return run(async (account) => pairs(await rpc(account, 'res.users', 'name_search', [], { name: query, domain: [['share', '=', false]], limit: 20 })));
}

export type TaskDraft = { name: string; description: string; assignees: Person[] };

function commandIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const out: number[] = [];
  for (const item of value) {
    if (typeof item === 'number') out.push(item);
    else if (Array.isArray(item) && item[0] === 6 && Array.isArray(item[2])) out.push(...item[2].filter((id: unknown): id is number => typeof id === 'number'));
    else if (Array.isArray(item) && item[0] === 4 && typeof item[1] === 'number') out.push(item[1]);
  }
  return out;
}

export function taskDraft(messageId: number) {
  return run(async (account): Promise<TaskDraft> => {
    const raw = await rpc<Record<string, unknown>>(account, 'kaitech.chat.make.task', 'default_get', [['message_id', 'name', 'description', 'user_ids']], {
      context: { default_message_id: messageId },
    });
    const ids = commandIds(raw?.user_ids);
    const users = ids.length ? await rpc<{ id: number; name: string }[]>(account, 'res.users', 'read', [ids, ['name']]) : [];
    return { name: typeof raw?.name === 'string' ? raw.name : '', description: typeof raw?.description === 'string' ? raw.description : '', assignees: people(users) };
  });
}

export function makeTask(input: { messageId: number; name: string; description: string; projectId: number | null; userIds: number[]; deadline: number | null }) {
  return run(async (account) => {
    const id = await rpc<number>(account, 'kaitech.chat.make.task', 'create', [
      {
        message_id: input.messageId,
        name: input.name,
        description: input.description,
        project_id: input.projectId || false,
        user_ids: [[6, 0, input.userIds]],
        date_deadline: input.deadline ? odooDatetime(input.deadline) : false,
      },
    ]);
    await rpc(account, 'kaitech.chat.make.task', 'action_make_task', [[id]]);
  });
}

export type ActivityDraft = { summary: string; note: string; types: Person[]; context: Record<string, unknown> };

export function activityDraft(messageId: number) {
  return run(async (account): Promise<ActivityDraft> => {
    const action = await rpc<Record<string, unknown>>(account, 'mail.message', 'kaitech_chat_activity_action', [[messageId]]);
    const context = isRecord(action?.context) ? action.context : {};
    const types = await rpc<{ id: number; name: string }[]>(account, 'mail.activity.type', 'search_read', [[['res_model', '=', false]]], { fields: ['name'], limit: 30 });
    return {
      summary: typeof context.default_summary === 'string' ? context.default_summary : '',
      note: typeof context.default_note === 'string' ? context.default_note : '',
      types: people(types),
      context,
    };
  });
}

export function makeActivity(input: { summary: string; note: string; typeId: number | null; deadline: number; context: Record<string, unknown> }) {
  return run(async (account) => {
    const id = await rpc<number>(
      account,
      'mail.activity.schedule',
      'create',
      [
        {
          summary: input.summary,
          note: input.note,
          date_deadline: odooDate(input.deadline),
          ...(input.typeId ? { activity_type_id: input.typeId } : {}),
        },
      ],
      { context: input.context },
    );
    await rpc(account, 'mail.activity.schedule', 'action_schedule_activities', [[id]], { context: input.context });
  });
}

export type Slot = { start: number; stop: number };
export type MeetingDraft = { name: string; attendees: Person[]; members: Person[]; duration: number; slots: Slot[] };
export type Busy = { partnerId: number; name: string; start: number; stop: number };

function slots(value: unknown): Slot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const start = fromOdooDatetime(item.start);
    const stop = fromOdooDatetime(item.stop);
    return start && stop ? [{ start, stop }] : [];
  });
}

export function meetingDraft(channelId: number, messageId: number | null) {
  return run(async (account): Promise<MeetingDraft> => {
    const raw = await rpc<Record<string, unknown>>(account, 'calendar.event', 'kaitech_chat_meeting_draft', [channelId, messageId ?? false]);
    return {
      name: typeof raw?.name === 'string' ? raw.name : '',
      attendees: people(raw?.attendees),
      members: people(raw?.members),
      duration: typeof raw?.duration === 'number' ? raw.duration : 30,
      slots: slots(raw?.slots),
    };
  });
}

export function meetingBusy(channelId: number, messageId: number | null, partnerIds: number[], start: number, stop: number) {
  return run(async (account): Promise<Busy[]> => {
    const raw = await rpc<unknown>(account, 'calendar.event', 'kaitech_chat_busy', [channelId, messageId ?? false, partnerIds, odooDatetime(start), odooDatetime(stop)]);
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      if (!isRecord(item) || typeof item.partner_id !== 'number') return [];
      const from = fromOdooDatetime(item.start);
      const to = fromOdooDatetime(item.stop);
      return from && to ? [{ partnerId: item.partner_id, name: typeof item.name === 'string' ? item.name : '', start: from, stop: to }] : [];
    });
  });
}

export function scheduleMeeting(input: { channelId: number; messageId: number | null; name: string; partnerIds: number[]; start: number; stop: number }) {
  return run(async (account) => {
    const raw = await rpc<Record<string, unknown>>(account, 'calendar.event', 'kaitech_chat_schedule', [
      input.channelId,
      input.messageId ?? false,
      input.name,
      input.partnerIds,
      odooDatetime(input.start),
      odooDatetime(input.stop),
    ]);
    return { id: typeof raw?.id === 'number' ? raw.id : 0, link: typeof raw?.videocall_location === 'string' ? raw.videocall_location : '' };
  });
}

export function messageLink(origin: string, message: Message): string {
  return `${origin}/mail/message/${message.id}`;
}
