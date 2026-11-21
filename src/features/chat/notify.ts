import { AppRegistry, Platform } from 'react-native';
import type { Account } from '../../auth/oauth';
import { getSession } from '../../auth/session';
import { accountForPush } from '../call/account';
import { callNative } from '../call/native';
import { ChatClient, sendErrorFrom } from './api';
import { composeBody } from './html';
import type { Conversation } from './types';

export const muteChoices = [
  { key: 'hours8', minutes: 480 },
  { key: 'week', minutes: 10080 },
  { key: 'always', minutes: -1 },
] as const;

const foreverYear = 9000;
const replyAttempts = 2;
const retryDelayMs = 3000;

export function mutedUntilMs(value: string | null, now: number): number | null {
  if (!value) return null;
  const at = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(at)) return null;
  if (new Date(at).getUTCFullYear() >= foreverYear) return Number.MAX_SAFE_INTEGER;
  return at > now ? at : null;
}

export function mutedForever(value: string | null, now: number): boolean {
  return mutedUntilMs(value, now) === Number.MAX_SAFE_INTEGER;
}

export function mutedEntries(conversations: Pick<Conversation, 'id' | 'mutedUntil'>[], now: number): { ids: number[]; until: number[] } {
  const ids: number[] = [];
  const until: number[] = [];
  for (const conversation of conversations) {
    const at = mutedUntilMs(conversation.mutedUntil, now);
    if (at === null) continue;
    ids.push(conversation.id);
    until.push(at);
  }
  return { ids, until };
}

export type MessageTaskData = { kind?: string; db?: string; uid?: number; channelId?: number; text?: string; sendKey?: string; messageId?: number };

type TaskClient = Pick<ChatClient, 'post' | 'markAsRead'>;
type ResultSink = { messageResult(db: string, uid: number, channelId: number, sendKey: string, ok: boolean): Promise<boolean> } | null;

export async function runMessageTask(
  data: MessageTaskData,
  deps: { accounts: () => Account[]; client: (account: Account) => TaskClient; native: () => ResultSink; wait: (ms: number) => Promise<void> } = {
    accounts: () => getSession().accounts,
    client: (account) => new ChatClient(account),
    native: () => callNative(),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  },
): Promise<void> {
  const channelId = Number(data.channelId);
  if (!Number.isInteger(channelId) || channelId <= 0) return;
  const account = accountForPush({ db: data.db, uid: data.uid }, deps.accounts());
  if (data.kind === 'read') {
    const messageId = Number(data.messageId);
    if (account && Number.isInteger(messageId) && messageId > 0) await deps.client(account).markAsRead(channelId, messageId).catch(() => undefined);
    return;
  }
  if (data.kind !== 'reply') return;
  const text = data.text?.trim() ?? '';
  const sendKey = data.sendKey ?? '';
  if (!text || !sendKey) return;
  let ok = false;
  if (account) {
    const client = deps.client(account);
    for (let attempt = 0; attempt < replyAttempts && !ok; attempt++) {
      if (attempt) await deps.wait(retryDelayMs);
      try {
        await client.post({ key: sendKey, channelId, body: composeBody(text, []), parentId: null, partnerIds: [], mentionTokens: {}, files: [] });
        ok = true;
      } catch (error) {
        if (!sendErrorFrom(error).retry) break;
      }
    }
  }
  await deps
    .native()
    ?.messageResult(data.db ?? '', Number(data.uid) || 0, channelId, sendKey, ok)
    .catch(() => undefined);
}

export function registerMessageTask() {
  if (Platform.OS !== 'android') return;
  AppRegistry.registerHeadlessTask('KaitechMessageAction', () => (data: MessageTaskData) => runMessageTask(data));
}

let mutedSent = '';
let openSent = '';

export function mirrorHidden(hidden: boolean) {
  void callNative()?.setMessagesHidden(hidden).catch(() => undefined);
}

export function mirrorLanguage(language: string) {
  void callNative()?.setMessageLanguage(language).catch(() => undefined);
}

export function mirrorMuted(account: Pick<Account, 'db' | 'userId'>, conversations: Pick<Conversation, 'id' | 'mutedUntil'>[]) {
  const native = callNative();
  if (!native) return;
  const { ids, until } = mutedEntries(conversations, Date.now());
  const marker = JSON.stringify([account.db, account.userId, ids, until]);
  if (marker === mutedSent) return;
  mutedSent = marker;
  void native.setMutedConversations(account.db, account.userId, ids, until).catch(() => undefined);
}

export function mirrorOpen(account: Pick<Account, 'db' | 'userId'> | null, channelIds: number[]) {
  const native = callNative();
  if (!native) return;
  const marker = JSON.stringify([account?.db, account?.userId, channelIds]);
  if (marker === openSent) return;
  openSent = marker;
  void native.setOpenConversations(account?.db ?? '', account?.userId ?? 0, account ? channelIds : []).catch(() => undefined);
}

export function forgetMessages(account: Pick<Account, 'db' | 'userId'>) {
  void callNative()?.clearAccountMessages(account.db, account.userId).catch(() => undefined);
}

export function bubbleSettingsAvailable(): boolean {
  return Platform.OS === 'android' && Number(Platform.Version) >= 30 && callNative() !== null;
}

export function openBubbleSettings(account: Pick<Account, 'db' | 'userId'>, channelId: number) {
  void callNative()?.openBubbleSettings(account.db, account.userId, channelId).catch(() => undefined);
}
