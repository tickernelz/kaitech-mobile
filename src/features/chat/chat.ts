import { randomUUID } from 'expo-crypto';
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { Account } from '../../auth/oauth';
import { onAccountForgotten } from '../../auth/session';
import { ChatClient, errorCode, sendErrorFrom } from './api';
import { forgetChatAccount } from './cleanup';
import { forgetDrafts } from './drafts';
import { clearOpenedFiles, dropFile, sweepStaging } from './files';
import { allPendingFileUris, cachedConversations, cachedMessages, forgetAccount, pendingFor, removePending, savePending, storeConversations, storeMessages } from './db';
import { composeBody, mentionsInText } from './html';
import { bodyPreview } from './markdown';
import {
  channelInfoFromStore,
  conversationPage,
  conversationPhotos,
  fullMessages,
  lastMessageOf,
  membersFromStore,
  messagesFromStore,
  reactionUpdates,
  seenFromStore,
  subChannelsFromStore,
  typingFromStore,
  type ChannelInfo,
} from './odoo';
import { Outbox, retryDelay, type Sent } from './outbox';
import { Realtime, type Notification, type RealtimeState } from './realtime';
import type { Conversation, Member, Mention, Message, Pending, PendingFile } from './types';
import { setUploadProgress } from './progress';
import { onPresenceChange, userInApp } from '../call/presence';
import { notePhotoList, notePhotos } from '../people/photos';

export type Typist = { partnerId: number; name: string; until: number };

export type Thread = {
  messages: Message[];
  loading: boolean;
  loaded: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  error: string | null;
  members: Member[];
  typing: Typist[];
  hasNewer: boolean;
  info: ChannelInfo | null;
  subChannels: Record<number, number>;
};

export type Delivered = { key: string; messageId: number; pending: Pending };

export type ChatState = {
  accountId: string | null;
  partnerId: number;
  origin: string;
  conversations: Conversation[];
  nextCursor: string | null;
  listLoading: boolean;
  listLoaded: boolean;
  listError: string | null;
  threads: Record<number, Thread>;
  pending: Pending[];
  delivered: Delivered[];
  online: boolean;
  realtime: RealtimeState;
  openChannels: number[];
  invited: number[];
};

const emptyThread: Thread = { messages: [], loading: false, loaded: false, hasOlder: true, loadingOlder: false, error: null, members: [], typing: [], hasNewer: false, info: null, subChannels: {} };
const pageSize = 30;
const typingMs = 6000;

let state: ChatState = {
  accountId: null,
  partnerId: 0,
  origin: '',
  conversations: [],
  nextCursor: null,
  listLoading: false,
  listLoaded: false,
  listError: null,
  threads: {},
  pending: [],
  delivered: [],
  online: true,
  realtime: 'closed',
  openChannels: [],
  invited: [],
};

const listeners = new Set<() => void>();
let client: ChatClient | null = null;
let outbox: Outbox | null = null;
let realtime: Realtime | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let readTimers = new Map<number, ReturnType<typeof setTimeout>>();
let teardown: (() => void)[] = [];
let active = false;

function set(next: Partial<ChatState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useChat<T>(select: (current: ChatState) => T): T {
  return useSyncExternalStore(subscribe, () => select(state));
}

export function getChat(): ChatState {
  return state;
}

export function threadOf(current: ChatState, channelId: number): Thread {
  return current.threads[channelId] ?? emptyThread;
}

function patchThread(channelId: number, patch: Partial<Thread> | ((thread: Thread) => Partial<Thread>)) {
  const thread = threadOf(state, channelId);
  const next = typeof patch === 'function' ? patch(thread) : patch;
  set({ threads: { ...state.threads, [channelId]: { ...thread, ...next } } });
}

function mergeMessages(existing: Message[], incoming: Message[]): Message[] {
  if (!incoming.length) return existing;
  const byId = new Map(existing.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function scheduleRetry() {
  if (retryTimer || !outbox) return;
  const waiting = state.pending.filter((item) => item.state === 'queued');
  if (!waiting.length) return;
  const delay = retryDelay(Math.max(1, ...waiting.map((item) => item.attempts)));
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
}

async function flush() {
  if (!outbox) return;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  await outbox.flush();
  scheduleRetry();
}

function notePeople(store: unknown) {
  notePhotos(state.accountId, store);
}

function delivered(sent: Sent) {
  const { pending } = sent;
  notePeople(sent.data);
  pending.files.forEach((file) => dropFile(file.uri));
  const message = messagesFromStore(sent.data, state.partnerId).find((item) => item.id === sent.messageId);
  if (message) {
    upsertMessages(pending.channelId, [message]);
    touchConversation(pending.channelId, message);
    return;
  }
  set({ delivered: [...state.delivered.filter((item) => item.key !== pending.key), { key: pending.key, messageId: sent.messageId, pending }] });
  void fetchNewer(pending.channelId);
}

function upsertMessages(channelId: number, incoming: Message[]) {
  if (!incoming.length || !state.accountId) return;
  const arrived = new Set(incoming.map((message) => message.id));
  if (state.threads[channelId]) patchThread(channelId, (thread) => ({ messages: mergeMessages(thread.messages, incoming) }));
  if (state.delivered.some((item) => arrived.has(item.messageId))) set({ delivered: state.delivered.filter((item) => !arrived.has(item.messageId)) });
  void storeMessages(state.accountId, channelId, incoming);
}

function touchConversation(channelId: number, message: Message): boolean {
  const index = state.conversations.findIndex((conversation) => conversation.id === channelId);
  if (index < 0) return false;
  const current = state.conversations[index];
  if (current.last && current.last.id > message.id) return true;
  const mine = message.authorId === state.partnerId;
  const visible = active && state.openChannels.includes(channelId);
  const updated: Conversation = {
    ...current,
    activityAt: Math.max(current.activityAt, message.date),
    last: lastMessageOf(message, bodyPreview(message.body)),
    unread: mine || visible ? current.unread : current.unread + 1,
  };
  const rest = state.conversations.filter((conversation) => conversation.id !== channelId);
  const conversations = [updated, ...rest].sort((a, b) => b.activityAt - a.activityAt || b.id - a.id);
  set({ conversations });
  if (state.accountId) void storeConversations(state.accountId, [updated], false);
  return true;
}

const realtimeListeners = new Set<(notification: Notification) => void>();

export function onRealtimeNotifications(listener: (notification: Notification) => void): () => void {
  realtimeListeners.add(listener);
  return () => realtimeListeners.delete(listener);
}

function noteInvitations(store: unknown) {
  const channels = (store as { 'discuss.channel'?: { id?: unknown; invited_member_ids?: unknown }[] } | null)?.['discuss.channel'];
  if (!Array.isArray(channels)) return;
  let next = state.invited;
  for (const channel of channels) {
    if (typeof channel?.id !== 'number' || !('invited_member_ids' in channel)) continue;
    const commands = Array.isArray(channel.invited_member_ids) ? channel.invited_member_ids : [];
    const invited = commands.some((command: unknown) => Array.isArray(command) && command[0] === 'ADD' && Array.isArray(command[1]) && command[1].length > 0);
    next = invited ? [...new Set([...next, channel.id])] : next.filter((id) => id !== channel.id);
  }
  if (next !== state.invited) set({ invited: next });
}

export function invitedChannels(): number[] {
  return state.invited;
}

function onNotifications(notifications: Notification[]) {
  for (const notification of notifications) {
    notePeople(notification.payload);
    for (const listener of realtimeListeners) listener(notification);
    noteInvitations(notification.payload);
    if (notification.type === 'discuss.channel/new_message') {
      const payload = notification.payload as { data?: unknown; id?: unknown };
      const channelId = typeof payload.id === 'number' ? payload.id : 0;
      notePeople(payload.data);
      const messages = messagesFromStore(payload.data, state.partnerId).filter((message) => message.channelId === channelId);
      if (!channelId || !messages.length) continue;
      upsertMessages(channelId, messages);
      const known = touchConversation(channelId, messages[messages.length - 1]);
      if (!known) void refreshConversations();
      if (active && state.openChannels.includes(channelId)) scheduleRead(channelId);
      continue;
    }
    if (notification.type !== 'mail.record/insert') continue;
    const data = notification.payload;
    for (const message of fullMessages(data, state.partnerId)) {
      if (state.threads[message.channelId]?.messages.some((existing) => existing.id === message.id)) upsertMessages(message.channelId, [message]);
    }
    const reactions = reactionUpdates(data, state.partnerId);
    if (reactions.size) {
      const threads = { ...state.threads };
      for (const [channelId, thread] of Object.entries(threads)) {
        if (!thread.messages.some((message) => reactions.has(message.id))) continue;
        threads[Number(channelId)] = {
          ...thread,
          messages: thread.messages.map((message) => (reactions.has(message.id) ? { ...message, reactions: reactions.get(message.id) ?? [] } : message)),
        };
      }
      set({ threads });
    }
    for (const seen of seenFromStore(data)) {
      if (seen.partnerId === state.partnerId) {
        const conversation = state.conversations.find((item) => item.id === seen.channelId);
        if (conversation && conversation.last && conversation.last.id <= seen.seenMessageId && conversation.unread) {
          set({ conversations: state.conversations.map((item) => (item.id === seen.channelId ? { ...item, unread: 0 } : item)) });
        }
      }
      if (!state.threads[seen.channelId]) continue;
      patchThread(seen.channelId, (thread) => {
        const others = thread.members.filter((member) => member.partnerId !== seen.partnerId);
        const before = thread.members.find((member) => member.partnerId === seen.partnerId)?.seenMessageId ?? 0;
        return { members: [...others, { partnerId: seen.partnerId, seenMessageId: Math.max(before, seen.seenMessageId) }] };
      });
    }
    for (const typing of typingFromStore(data)) {
      if (typing.partnerId === state.partnerId || !state.threads[typing.channelId]) continue;
      patchThread(typing.channelId, (thread) => {
        const others = thread.typing.filter((typist) => typist.partnerId !== typing.partnerId);
        return { typing: typing.typing ? [...others, { partnerId: typing.partnerId, name: typing.name, until: Date.now() + typingMs }] : others };
      });
      if (typing.typing) setTimeout(() => expireTyping(typing.channelId), typingMs + 100);
    }
  }
}

function expireTyping(channelId: number) {
  const thread = state.threads[channelId];
  if (!thread?.typing.length) return;
  const now = Date.now();
  const typing = thread.typing.filter((typist) => typist.until > now);
  if (typing.length !== thread.typing.length) patchThread(channelId, { typing });
}

function onRealtimeState(next: RealtimeState, reconnected: boolean) {
  set({ realtime: next });
  if (next === 'open' && reconnected) {
    void refreshConversations();
    for (const channelId of state.openChannels) void fetchNewer(channelId);
  }
}

function stop() {
  realtime?.stop();
  realtime = null;
  client = null;
  outbox = null;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  readTimers.forEach((timer) => clearTimeout(timer));
  readTimers = new Map();
  teardown.forEach((undo) => undo());
  teardown = [];
}

export function startChat(account: Account) {
  if (state.accountId === account.id && client) return;
  stop();
  client = new ChatClient(account);
  const pending = pendingFor(account.id);
  sweepStaging(allPendingFileUris());
  state = {
    ...state,
    accountId: account.id,
    partnerId: account.partnerId,
    origin: account.origin,
    conversations: cachedConversations(account.id),
    nextCursor: null,
    listLoading: false,
    listLoaded: false,
    listError: null,
    threads: {},
    pending,
    delivered: [],
    openChannels: [],
    invited: [],
  };
  listeners.forEach((listener) => listener());
  const current = client;
  outbox = new Outbox(
    {
      upload: async (item: Pending, file: PendingFile) => {
        try {
          return await current.upload(item.channelId, file, (fraction) => setUploadProgress(file.key, fraction));
        } catch (error) {
          throw sendErrorFrom(error);
        } finally {
          setUploadProgress(file.key, null);
        }
      },
      post: async (item: Pending, files) => {
        const mentions = mentionsInText(item.text, item.mentions);
        try {
          return await current.post({
            key: item.key,
            channelId: item.channelId,
            body: composeBody(item.text, mentions),
            parentId: item.parentId,
            partnerIds: mentions.map((mention) => mention.id),
            mentionTokens: Object.fromEntries(mentions.filter((mention) => mention.token).map((mention) => [String(mention.id), mention.token as string])),
            files,
          });
        } catch (error) {
          throw sendErrorFrom(error);
        }
      },
    },
    { save: savePending, remove: removePending },
    (items) => {
      if (client === current) set({ pending: items });
    },
    delivered,
  );
  outbox.load(pending);
  active = userInApp(AppState.currentState);
  realtime = new Realtime(current, onNotifications, onRealtimeState);
  if (active) realtime.start();
  void refreshConversations();
  void flush();
  const network = addNetworkStateListener((network) => {
    const online = network.isConnected !== false && network.isInternetReachable !== false;
    const wasOnline = state.online;
    set({ online });
    if (online !== wasOnline) realtime?.reconnectNow();
    if (online && !wasOnline) {
      void flush();
      void refreshConversations();
    }
  });
  void getNetworkStateAsync().then((network) => set({ online: network.isConnected !== false && network.isInternetReachable !== false }));
  const stopPresence = onPresenceChange((next) => {
    const nowActive = userInApp(next);
    if (nowActive === active) return;
    active = nowActive;
    if (active) {
      realtime?.start();
      void refreshConversations();
      void flush();
      for (const channelId of state.openChannels) {
        void fetchNewer(channelId);
        scheduleRead(channelId);
      }
    } else {
      realtime?.stop();
    }
  });
  teardown = [() => network.remove(), stopPresence];
}

export function stopChat() {
  stop();
  set({ accountId: null, conversations: [], threads: {}, pending: [], delivered: [], openChannels: [], invited: [] });
}

onAccountForgotten((id) => {
  if (state.accountId === id) stopChat();
  clearOpenedFiles();
  void forgetChatAccount(id, { pendingFor, dropFile, forgetDrafts, forgetAccount });
});

export async function refreshConversations() {
  const current = client;
  const account = state.accountId;
  if (!current || !account || state.listLoading) return;
  set({ listLoading: true, listError: null });
  try {
    const body = await current.conversations(null);
    if (client !== current) return;
    const page = conversationPage(body);
    notePhotoList(account, conversationPhotos(body));
    set({ conversations: page.conversations, nextCursor: page.nextCursor, listLoaded: true, listLoading: false });
    await storeConversations(account, page.conversations, true);
  } catch (error) {
    if (client === current) set({ listLoading: false, listError: errorCode(error) });
  }
}

export async function loadMoreConversations() {
  const current = client;
  const account = state.accountId;
  if (!current || !account || state.listLoading || !state.nextCursor) return;
  set({ listLoading: true });
  try {
    const body = await current.conversations(state.nextCursor);
    if (client !== current) return;
    const page = conversationPage(body);
    notePhotoList(account, conversationPhotos(body));
    const known = new Set(state.conversations.map((conversation) => conversation.id));
    set({ conversations: [...state.conversations, ...page.conversations.filter((conversation) => !known.has(conversation.id))], nextCursor: page.nextCursor, listLoading: false });
    await storeConversations(account, page.conversations, false);
  } catch (error) {
    if (client === current) set({ listLoading: false, listError: errorCode(error) });
  }
}

export function conversationById(current: ChatState, channelId: number): Conversation | null {
  return current.conversations.find((conversation) => conversation.id === channelId) ?? null;
}

export function openThread(channelId: number): () => void {
  set({ openChannels: [...state.openChannels, channelId] });
  if (!state.threads[channelId] && state.accountId) {
    const cached = cachedMessages(state.accountId, channelId);
    patchThread(channelId, { messages: cached });
  }
  void loadLatest(channelId);
  scheduleRead(channelId);
  return () => {
    const index = state.openChannels.indexOf(channelId);
    if (index >= 0) set({ openChannels: state.openChannels.filter((_, position) => position !== index) });
  };
}

async function loadLatest(channelId: number) {
  const current = client;
  if (!current || threadOf(state, channelId).loading) return;
  patchThread(channelId, { loading: true, error: null });
  try {
    const [page, info] = await Promise.all([current.messages(channelId, { limit: pageSize }), current.channel(channelId).catch(() => null)]);
    if (client !== current) return;
    notePeople(page.data);
    notePeople(info);
    const fetched = messagesFromStore(page.data, state.partnerId).filter((message) => message.channelId === channelId);
    const members = info ? (membersFromStore(info).get(channelId) ?? []) : threadOf(state, channelId).members;
    const channelInfo = info ? channelInfoFromStore(info, channelId) : threadOf(state, channelId).info;
    patchThread(channelId, (thread) => {
      const oldest = fetched[0]?.id ?? Infinity;
      const newestCached = thread.messages[thread.messages.length - 1]?.id ?? 0;
      const contiguous = newestCached >= oldest || fetched.length < pageSize;
      return {
        messages: contiguous ? mergeMessages(thread.messages, fetched) : fetched,
        loading: false,
        loaded: true,
        hasOlder: fetched.length >= pageSize || (contiguous && thread.messages.some((message) => message.id < oldest)),
        members,
        info: channelInfo,
        hasNewer: false,
      };
    });
    if (channelInfo && channelInfo.type !== 'chat') void loadSubChannels(channelId);
    upsertMessages(channelId, fetched);
    scheduleRead(channelId);
  } catch (error) {
    if (client === current) patchThread(channelId, { loading: false, error: errorCode(error) });
  }
}

const newerPage = 100;

export async function fetchNewer(channelId: number) {
  const current = client;
  const thread = state.threads[channelId];
  if (!current || !thread) return;
  const newest = thread.messages[thread.messages.length - 1]?.id;
  if (!newest) return loadLatest(channelId);
  try {
    const page = await current.messages(channelId, { after: newest, limit: newerPage });
    if (client !== current) return;
    notePeople(page.data);
    const fetched = messagesFromStore(page.data, state.partnerId).filter((message) => message.channelId === channelId);
    upsertMessages(channelId, fetched);
    if (fetched.length < newerPage && state.threads[channelId]?.hasNewer) patchThread(channelId, { hasNewer: false });
    if (fetched.length) touchConversation(channelId, fetched[fetched.length - 1]);
  } catch {
    return;
  }
}

export async function loadAround(channelId: number, messageId: number): Promise<boolean> {
  const current = client;
  if (!current) return false;
  if (threadOf(state, channelId).messages.some((message) => message.id === messageId)) return true;
  try {
    const page = await current.messages(channelId, { around: messageId, limit: pageSize });
    if (client !== current) return false;
    notePeople(page.data);
    const fetched = messagesFromStore(page.data, state.partnerId).filter((message) => message.channelId === channelId);
    if (!fetched.some((message) => message.id === messageId)) return false;
    patchThread(channelId, (thread) => {
      const newestFetched = fetched[fetched.length - 1].id;
      const joins = thread.messages.some((message) => message.id <= newestFetched + 1 && message.id >= fetched[0].id);
      return { messages: joins ? mergeMessages(thread.messages, fetched) : fetched, hasOlder: true, hasNewer: !joins, loaded: true };
    });
    return true;
  } catch {
    return false;
  }
}

async function loadSubChannels(channelId: number) {
  const current = client;
  if (!current) return;
  try {
    const data = await current.subChannels(channelId);
    if (client !== current) return;
    const subChannels: Record<number, number> = {};
    for (const sub of subChannelsFromStore(data)) if (sub.fromMessageId) subChannels[sub.fromMessageId] = sub.id;
    patchThread(channelId, { subChannels });
  } catch {
    return;
  }
}

export async function openSubThread(channelId: number, messageId: number): Promise<number | null> {
  const known = threadOf(state, channelId).subChannels[messageId];
  if (known) return known;
  const current = client;
  if (!current) return null;
  try {
    const data = await current.openSubChannel(channelId, messageId);
    const sub = subChannelsFromStore(data).find((item) => item.fromMessageId === messageId);
    if (!sub) return null;
    patchThread(channelId, (thread) => ({ subChannels: { ...thread.subChannels, [messageId]: sub.id } }));
    return sub.id;
  } catch {
    return null;
  }
}

export async function loadOlder(channelId: number) {
  const current = client;
  const thread = threadOf(state, channelId);
  if (!current || thread.loadingOlder || !thread.hasOlder || !thread.messages.length) return;
  patchThread(channelId, { loadingOlder: true });
  try {
    const page = await current.messages(channelId, { before: thread.messages[0].id, limit: pageSize });
    if (client !== current) return;
    notePeople(page.data);
    const fetched = messagesFromStore(page.data, state.partnerId).filter((message) => message.channelId === channelId);
    patchThread(channelId, (latest) => ({ messages: mergeMessages(latest.messages, fetched), hasOlder: fetched.length >= pageSize, loadingOlder: false }));
    if (state.accountId) void storeMessages(state.accountId, channelId, fetched);
  } catch {
    if (client === current) patchThread(channelId, { loadingOlder: false });
  }
}

function scheduleRead(channelId: number) {
  if (!active || readTimers.has(channelId)) return;
  readTimers.set(
    channelId,
    setTimeout(() => {
      readTimers.delete(channelId);
      void markRead(channelId);
    }, 400),
  );
}

async function markRead(channelId: number) {
  const current = client;
  const thread = state.threads[channelId];
  if (!current || !thread || !state.openChannels.includes(channelId)) return;
  const newest = thread.messages[thread.messages.length - 1]?.id;
  if (!newest) return;
  const mine = thread.members.find((member) => member.partnerId === state.partnerId);
  const conversation = conversationById(state, channelId);
  if (conversation?.unread) set({ conversations: state.conversations.map((item) => (item.id === channelId ? { ...item, unread: 0 } : item)) });
  if (mine && mine.seenMessageId >= newest) return;
  try {
    await current.markAsRead(channelId, newest);
    patchThread(channelId, (latest) => ({
      members: [...latest.members.filter((member) => member.partnerId !== state.partnerId), { partnerId: state.partnerId, seenMessageId: newest }],
    }));
  } catch {
    return;
  }
}

export type Outgoing = { channelId: number; text: string; parentId: number | null; mentions: Mention[]; files: Omit<PendingFile, 'key' | 'attachmentId' | 'ownershipToken'>[] };

export function newKey(): string {
  return randomUUID();
}

const sendStarts = new Map<string, number>();

export function takeSendStart(key: string): number | undefined {
  const started = sendStarts.get(key);
  sendStarts.delete(key);
  return started;
}

export async function send(outgoing: Outgoing, startedAt?: number): Promise<string | null> {
  if (!outbox || !state.accountId) return null;
  if (!outgoing.text.trim() && !outgoing.files.length) return null;
  const key = newKey();
  if (startedAt !== undefined) sendStarts.set(key, startedAt);
  const item: Pending = {
    key,
    accountId: state.accountId,
    channelId: outgoing.channelId,
    text: outgoing.text.trim(),
    parentId: outgoing.parentId,
    mentions: mentionsInText(outgoing.text, outgoing.mentions),
    files: outgoing.files.map((file) => ({ ...file, key: newKey(), attachmentId: null, ownershipToken: null })),
    createdAt: Date.now(),
    attempts: 0,
    state: 'queued',
    error: null,
  };
  const adding = outbox.add(item);
  void adding.then(() => flush());
  return key;
}

export async function retrySend(key: string) {
  await outbox?.retry(key);
  void flush();
}

export async function discardSend(key: string) {
  const removed = await outbox?.discard(key);
  removed?.files.forEach((file) => dropFile(file.uri));
}

export async function toggleReaction(message: Message, content: string) {
  const current = client;
  if (!current) return;
  const existing = message.reactions.find((reaction) => reaction.content === content);
  const add = !existing?.mine;
  try {
    const data = await current.react(message.id, content, add);
    const updates = reactionUpdates(data, state.partnerId);
    if (updates.has(message.id)) {
      patchThread(message.channelId, (thread) => ({
        messages: thread.messages.map((item) => (item.id === message.id ? { ...item, reactions: updates.get(message.id) ?? [] } : item)),
      }));
    }
  } catch {
    return;
  }
}

export function notifyTyping(channelId: number, typing: boolean) {
  void client?.typing(channelId, typing).catch(() => undefined);
}

export async function muteConversation(channelId: number, minutes: number): Promise<string | null> {
  const current = client;
  const account = state.accountId;
  if (!current || !account) return 'signedOut';
  try {
    const answer = await current.mute(channelId, minutes);
    if (answer.channel_id !== channelId) return 'answerMismatch';
    const mutedUntil = typeof answer.muted_until === 'string' ? answer.muted_until : null;
    if (state.accountId !== account) return null;
    const conversations = state.conversations.map((item) => (item.id === channelId ? { ...item, mutedUntil } : item));
    set({ conversations });
    const changed = conversations.find((item) => item.id === channelId);
    if (changed) void storeConversations(account, [changed], false);
    return null;
  } catch (error) {
    return errorCode(error);
  }
}

export function chatClient(): ChatClient | null {
  return client;
}
