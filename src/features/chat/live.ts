import * as Location from 'expo-location';
import Storage from 'expo-sqlite/kv-store';
import { ApiError, route } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import { getSession } from '../../auth/session';
import i18n from '../../i18n';
import { getChat, patchMessages } from './chat';
import { distanceMeters, type Point } from './geo';
import { messagePatches } from './odoo';
import { fixOf, type Fix } from './places';

export const liveTask = 'kaitech-live-location';
export const liveStopUrl = 'kaitech-live-location://stop';
export const liveSettings = { intervalMs: 30000, moveMeters: 20, heartbeatMs: 120000, minGapMs: 5000 } as const;

export type Share = { messageId: number; channelId: number; until: number };
type Last = Point & { at: number };
type Saved = { shares: Share[]; last: Last | null };

export const keyOf = (accountId: string) => `chat.live.${accountId}`;
const listeners = new Set<() => void>();
let foreground: Location.LocationSubscription | null = null;
let settling: Promise<void> = Promise.resolve();

function read(accountId: string): Saved {
  try {
    const parsed = JSON.parse(Storage.getItemSync(keyOf(accountId)) ?? 'null') as Saved | null;
    return parsed && Array.isArray(parsed.shares) ? { shares: parsed.shares, last: parsed.last ?? null } : { shares: [], last: null };
  } catch {
    return { shares: [], last: null };
  }
}

function write(accountId: string, saved: Saved) {
  if (saved.shares.length) Storage.setItemSync(keyOf(accountId), JSON.stringify(saved));
  else Storage.removeItemSync(keyOf(accountId));
  listeners.forEach((listener) => listener());
}

export function liveShares(accountId: string, now = Date.now()): Share[] {
  return read(accountId).shares.filter((share) => share.until > now);
}

export function onLiveChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dueUpdate(last: Last | null, fix: Point, now: number): boolean {
  if (!last) return true;
  const gap = now - last.at;
  if (gap < liveSettings.minGapMs) return false;
  return gap >= liveSettings.heartbeatMs || distanceMeters(last, fix) >= liveSettings.moveMeters;
}

export function endedByServer(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'not_found' || error.reason === 'ended' || error.reason === 'not_found' || error.reason === 'not_author');
}

function applyFor(account: Account, answer: unknown) {
  if (getChat()?.accountId !== account.id) return;
  const store = answer && typeof answer === 'object' && 'store_data' in answer ? (answer as { store_data: unknown }).store_data : answer;
  patchMessages(messagePatches(store));
}

export async function pushFix(fix: Fix, now = Date.now()): Promise<void> {
  for (const account of getSession().accounts) {
    const saved = read(account.id);
    const shares = saved.shares.filter((share) => share.until > now);
    if (!shares.length || !dueUpdate(saved.last, fix, now)) {
      if (shares.length !== saved.shares.length) write(account.id, { shares, last: saved.last });
      continue;
    }
    const ended = new Set<number>();
    for (const share of shares) {
      try {
        const params = { message_id: share.messageId, latitude: fix.latitude, longitude: fix.longitude, ...(fix.accuracy !== null ? { accuracy: Math.min(10000, fix.accuracy) } : {}) };
        applyFor(account, await route<unknown>(account, '/kaitech_chat/location/update', params));
      } catch (error) {
        if (endedByServer(error)) ended.add(share.messageId);
      }
    }
    const fresh = read(account.id);
    write(account.id, { shares: fresh.shares.filter((share) => share.until > now && !ended.has(share.messageId)), last: { latitude: fix.latitude, longitude: fix.longitude, at: now } });
  }
  await settle();
}

function anyShare(now = Date.now()): boolean {
  return getSession().accounts.some((account) => liveShares(account.id, now).length > 0);
}

async function running(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(liveTask).catch(() => false);
}

async function start() {
  if (foreground || (await running())) return;
  const t = i18n.getFixedT(null, 'chat');
  const service = {
    notificationTitle: t('location.notification.title'),
    notificationBody: t('location.notification.body'),
    notificationColor: '#441D65',
    killServiceOnDestroy: false,
    stopActionTitle: t('location.notification.stop'),
    stopActionUrl: liveStopUrl,
  };
  try {
    await Location.startLocationUpdatesAsync(liveTask, {
      accuracy: Location.Accuracy.High,
      timeInterval: liveSettings.intervalMs,
      distanceInterval: 0,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.Other,
      foregroundService: service as Location.LocationTaskServiceOptions,
    });
  } catch {
    foreground = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: liveSettings.intervalMs, distanceInterval: 0 }, (position) => void pushFix(fixOf(position))).catch(() => null);
  }
}

async function stop() {
  foreground?.remove();
  foreground = null;
  if (await running()) await Location.stopLocationUpdatesAsync(liveTask).catch(() => undefined);
}

export function settle(): Promise<void> {
  settling = settling.then(() => (anyShare() ? start() : stop())).catch(() => undefined);
  return settling;
}

export function trackShare(accountId: string, share: Share) {
  const saved = read(accountId);
  write(accountId, { shares: [...saved.shares.filter((item) => item.channelId !== share.channelId), share], last: null });
  void settle();
}

export function forgetShares(accountId: string): Share[] {
  const shares = read(accountId).shares;
  Storage.removeItemSync(keyOf(accountId));
  listeners.forEach((listener) => listener());
  void settle();
  return shares;
}

export async function syncLive(account: Account): Promise<void> {
  const mine = read(account.id).shares;
  if (!mine.length) return settle();
  try {
    const answer = await route<{ shares?: { message_id?: unknown }[] }>(account, '/kaitech_chat/location/active', {});
    const active = new Set((answer?.shares ?? []).map((share) => share.message_id).filter((id): id is number => typeof id === 'number'));
    const asked = new Set(mine.map((share) => share.messageId));
    const fresh = read(account.id);
    write(account.id, { shares: fresh.shares.filter((share) => !asked.has(share.messageId) || active.has(share.messageId)), last: fresh.last });
  } catch {
    return settle();
  }
  return settle();
}

export function syncAllLive(): Promise<void> {
  return Promise.all(getSession().accounts.map((account) => syncLive(account))).then(() => undefined);
}

export async function stopShare(account: Account, messageId: number): Promise<boolean> {
  const saved = read(account.id);
  write(account.id, { shares: saved.shares.filter((share) => share.messageId !== messageId), last: saved.last });
  void settle();
  try {
    applyFor(account, await route<unknown>(account, '/kaitech_chat/location/stop', { message_id: messageId }));
    return true;
  } catch (error) {
    return endedByServer(error);
  }
}

export async function stopAllShares(): Promise<void> {
  for (const account of getSession().accounts) {
    for (const share of read(account.id).shares) await stopShare(account, share.messageId);
  }
  await settle();
}
