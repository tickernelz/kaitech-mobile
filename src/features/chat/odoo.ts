import { photoFrom, type Photo } from '../people/photo';
import type { Attachment, Conversation, ConversationType, LastMessage, Member, Message, Reaction } from './types';

type Raw = Record<string, unknown>;

function isRecord(value: unknown): value is Raw {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function records(data: unknown, model: string): Raw[] {
  if (!isRecord(data)) return [];
  const value = data[model];
  if (Array.isArray(value)) return value.filter(isRecord);
  return isRecord(value) ? [value] : [];
}

function id(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (isRecord(value)) return id(value.id);
  return null;
}

function ids(value: unknown): number[] {
  return Array.isArray(value) ? value.map(id).filter((item): item is number => item !== null) : [];
}

function text(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value[0] === 'markup' && typeof value[1] === 'string') return value[1];
  return '';
}

export function utc(value: unknown): number {
  const match = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)/.exec(text(value));
  if (!match) return 0;
  const [, y, mo, d, h, mi, s] = match.map(Number);
  return Date.UTC(y, mo - 1, d, h, mi, s);
}

const conversationTypes: ConversationType[] = ['chat', 'group', 'channel'];

function lastMessage(value: unknown): LastMessage | null {
  if (!isRecord(value)) return null;
  const messageId = id(value.id);
  if (!messageId) return null;
  return {
    id: messageId,
    authorId: id(value.author_id),
    author: text(value.author),
    text: text(value.text),
    attachments: typeof value.attachments === 'number' ? value.attachments : 0,
    voice: value.voice === true,
    call: text(value.type) === 'notification' && !text(value.text),
    type: text(value.type),
    date: utc(value.date),
  };
}

export function conversationFrom(value: unknown): Conversation | null {
  if (!isRecord(value)) return null;
  const conversationId = id(value.id);
  const type = conversationTypes.find((candidate) => candidate === value.type);
  if (!conversationId || !type) return null;
  return {
    id: conversationId,
    type,
    name: text(value.name),
    partnerId: id(value.partner_id),
    photo: type === 'chat' ? null : (photoFrom(value.photo) ?? null),
    unread: typeof value.unread === 'number' ? value.unread : 0,
    mutedUntil: typeof value.muted_until === 'string' ? value.muted_until : null,
    activityAt: utc(value.activity_at),
    last: lastMessage(value.last_message),
    pinned: typeof value.pinned === 'boolean' ? value.pinned : null,
    archived: typeof value.archived === 'boolean' ? value.archived : null,
  };
}

export type ArchivedSummary = { count: number; unread: number };

export function conversationPage(body: unknown): { conversations: Conversation[]; nextCursor: string | null; archived: ArchivedSummary | null } {
  if (!isRecord(body) || !Array.isArray(body.conversations)) return { conversations: [], nextCursor: null, archived: null };
  return {
    conversations: body.conversations.map(conversationFrom).filter((item): item is Conversation => item !== null),
    nextCursor: typeof body.next_cursor === 'string' ? body.next_cursor : null,
    archived: typeof body.archived_count === 'number' ? { count: body.archived_count, unread: typeof body.archived_unread === 'number' ? body.archived_unread : 0 } : null,
  };
}

export function listOrder(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.activityAt - a.activityAt || b.id - a.id);
}

export function conversationPhotos(body: unknown): [number, Photo | null][] {
  if (!isRecord(body) || !Array.isArray(body.conversations)) return [];
  const out: [number, Photo | null][] = [];
  for (const raw of body.conversations) {
    if (!isRecord(raw)) continue;
    const partnerId = raw.type === 'chat' ? id(raw.partner_id) : null;
    const photo = photoFrom(raw.photo);
    if (partnerId && photo !== undefined) out.push([partnerId, photo]);
    const last = isRecord(raw.last_message) ? raw.last_message : null;
    const authorId = last ? id(last.author_id) : null;
    const authorPhoto = last ? photoFrom(last.author_photo) : undefined;
    if (authorId && authorPhoto !== undefined) out.push([authorId, authorPhoto]);
  }
  return out;
}

function attachmentFrom(value: Raw): Attachment | null {
  const attachmentId = id(value.id);
  if (!attachmentId) return null;
  return {
    id: attachmentId,
    name: text(value.name),
    mimetype: text(value.mimetype),
    size: typeof value.file_size === 'number' ? value.file_size : 0,
    voice: Array.isArray(value.voice_ids) && value.voice_ids.length > 0,
    accessToken: text(value.raw_access_token) || null,
    checksum: text(value.checksum) || null,
    url: value.type === 'url' ? text(value.url) || null : null,
  };
}

function reactionsFromStore(data: unknown, myPartnerId: number): Map<number, Reaction[]> {
  const byMessage = new Map<number, Reaction[]>();
  for (const raw of records(data, 'mail.message.reaction')) {
    const messageId = id(raw.message);
    const content = text(raw.content);
    if (!messageId || !content) continue;
    const list = byMessage.get(messageId) ?? [];
    list.push({
      content,
      count: typeof raw.count === 'number' ? raw.count : ids(raw.partners).length + ids(raw.guests).length,
      mine: ids(raw.partners).includes(myPartnerId),
    });
    byMessage.set(messageId, list);
  }
  return byMessage;
}

export function messagesFromStore(data: unknown, myPartnerId: number): Message[] {
  const partners = new Map(records(data, 'res.partner').map((partner) => [id(partner.id), text(partner.name)]));
  const guests = new Map(records(data, 'mail.guest').map((guest) => [id(guest.id), text(guest.name)]));
  const attachments = new Map<number, Attachment>();
  for (const raw of records(data, 'ir.attachment')) {
    const attachment = attachmentFrom(raw);
    if (attachment) attachments.set(attachment.id, attachment);
  }
  const reactions = reactionsFromStore(data, myPartnerId);
  const messages: Message[] = [];
  for (const raw of records(data, 'mail.message')) {
    const messageId = id(raw.id);
    if (!messageId || raw.model !== 'discuss.channel') continue;
    const channelId = id(raw.res_id);
    if (!channelId) continue;
    const authorId = id(raw.author_id);
    const guestId = id(raw.author_guest_id);
    messages.push({
      id: messageId,
      channelId,
      authorId,
      author: (authorId ? partners.get(authorId) : guestId ? guests.get(guestId) : undefined) ?? text(raw.email_from),
      body: text(raw.body),
      date: utc(raw.date),
      type: text(raw.message_type),
      attachments: ids(raw.attachment_ids)
        .map((attachmentId) => attachments.get(attachmentId))
        .filter((item): item is Attachment => item !== undefined),
      parentId: id(raw.parent_id),
      reactions: reactions.get(messageId) ?? [],
    });
  }
  return messages.sort((a, b) => a.id - b.id);
}

export function membersFromStore(data: unknown): Map<number, Member[]> {
  const byChannel = new Map<number, Member[]>();
  for (const raw of records(data, 'discuss.channel.member')) {
    const channelId = id(raw.channel_id);
    const partnerId = id(raw.partner_id);
    if (!channelId || !partnerId) continue;
    const list = byChannel.get(channelId) ?? [];
    list.push({ partnerId, seenMessageId: id(raw.seen_message_id) ?? 0 });
    byChannel.set(channelId, list);
  }
  return byChannel;
}

export type ReadState = 'sent' | 'read';

export function readState(message: Message, members: Member[], myPartnerId: number): ReadState {
  return members.some((member) => member.partnerId !== myPartnerId && member.seenMessageId >= message.id) ? 'read' : 'sent';
}

export function readersOf(message: Message, members: Member[], myPartnerId: number): number {
  return members.filter((member) => member.partnerId !== myPartnerId && member.seenMessageId >= message.id).length;
}

export function attachmentUrl(origin: string, attachment: Attachment, options: { download?: boolean; token?: boolean } = {}): string {
  const { download = false, token = true } = options;
  const image = attachment.mimetype.startsWith('image/');
  const params = new URLSearchParams();
  if (token && attachment.accessToken) params.set('access_token', attachment.accessToken);
  if (attachment.name) params.set('filename', attachment.name);
  if (attachment.checksum) params.set('unique', attachment.checksum);
  if (download) params.set('download', 'true');
  const query = params.toString();
  return `${origin}/web/${image ? 'image' : 'content'}/${attachment.id}${query ? `?${query}` : ''}`;
}

export type Typing = { channelId: number; partnerId: number; name: string; typing: boolean };

export function typingFromStore(data: unknown): Typing[] {
  const partners = new Map(records(data, 'res.partner').map((partner) => [id(partner.id), text(partner.name)]));
  const out: Typing[] = [];
  for (const raw of records(data, 'discuss.channel.member')) {
    if (typeof raw.isTyping !== 'boolean') continue;
    const channelId = id(raw.channel_id);
    const partnerId = id(raw.partner_id);
    if (!channelId || !partnerId) continue;
    out.push({ channelId, partnerId, name: partners.get(partnerId) ?? '', typing: raw.isTyping });
  }
  return out;
}

export function seenFromStore(data: unknown): { channelId: number; partnerId: number; seenMessageId: number }[] {
  const out: { channelId: number; partnerId: number; seenMessageId: number }[] = [];
  for (const raw of records(data, 'discuss.channel.member')) {
    const channelId = id(raw.channel_id);
    const partnerId = id(raw.partner_id);
    const seenMessageId = id(raw.seen_message_id);
    if (channelId && partnerId && seenMessageId) out.push({ channelId, partnerId, seenMessageId });
  }
  return out;
}

export function reactionUpdates(data: unknown, myPartnerId: number): Map<number, Reaction[]> {
  const byMessage = reactionsFromStore(data, myPartnerId);
  const updates = new Map<number, Reaction[]>();
  for (const raw of records(data, 'mail.message')) {
    const messageId = id(raw.id);
    if (messageId && 'reactions' in raw && !('body' in raw)) updates.set(messageId, byMessage.get(messageId) ?? []);
  }
  return updates;
}

export function fullMessages(data: unknown, myPartnerId: number): Message[] {
  const complete = new Set(
    records(data, 'mail.message')
      .filter((raw) => 'body' in raw && 'res_id' in raw)
      .map((raw) => id(raw.id)),
  );
  return messagesFromStore(data, myPartnerId).filter((message) => complete.has(message.id));
}

export function isCallNotice(message: Pick<Message, 'type' | 'body'>): boolean {
  return message.type === 'notification' && message.body.includes('data-oe-type="call"');
}

export function lastMessageOf(message: Message, plain: string): LastMessage {
  return {
    id: message.id,
    authorId: message.authorId,
    author: message.author,
    text: plain.slice(0, 160),
    attachments: message.attachments.length,
    voice: message.attachments.some((attachment) => attachment.voice),
    call: isCallNotice(message),
    type: message.type,
    date: message.date,
  };
}

export function subChannelsFromStore(data: unknown): { id: number; name: string; fromMessageId: number | null }[] {
  return records(data, 'discuss.channel')
    .filter((raw) => id(raw.id) !== null && id(raw.parent_channel_id) !== null)
    .map((raw) => ({ id: id(raw.id) ?? 0, name: text(raw.name), fromMessageId: id(raw.from_message_id) }));
}

export type ChannelInfo = { name: string; type: string; memberCount: number; parentId: number | null };

export function channelInfoFromStore(data: unknown, channelId: number): ChannelInfo | null {
  const raw = records(data, 'discuss.channel').find((item) => id(item.id) === channelId);
  if (!raw) return null;
  return {
    name: text(raw.name),
    type: text(raw.channel_type),
    memberCount: typeof raw.member_count === 'number' ? raw.member_count : 0,
    parentId: id(raw.parent_channel_id),
  };
}

