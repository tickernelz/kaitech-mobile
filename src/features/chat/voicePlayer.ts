import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { meetingRecording } from '../../audio/meeting';
import { getSession, onAccountForgotten } from '../../auth/session';

export type VoiceMeta = { title: string; channelId: number; messageId: number | null };
export type VoiceState = { id: string | null; playing: boolean; position: number; duration: number; rate: number; loading: boolean; meta: VoiceMeta | null };
export type VoiceSource = { id: string; uri: string; headers?: Record<string, string>; meta?: VoiceMeta };

export const voiceRates = [1, 1.5, 2] as const;
export const nextVoiceDelayMs = 400;
const playedLimit = 500;

let state: VoiceState = { id: null, playing: false, position: 0, duration: 0, rate: 1, loading: false, meta: null };
const listeners = new Set<() => void>();
let player: AudioPlayer | null = null;
let subscription: { remove(): void } | null = null;
let startWhenLoaded = false;
let pendingFraction: number | null = null;
let pendingPosition: number | null = null;
let lockScreen = false;
const positions = new Map<string, number>();
let nextOf: ((id: string) => VoiceSource | null) | null = null;
let nextTimer: ReturnType<typeof setTimeout> | null = null;

const rateKey = (account: string) => `voice.rate.${account}`;
const playedKey = (account: string) => `voice.played.${account}`;
const activeAccount = () => getSession().activeId;

function set(next: Partial<VoiceState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function rateFor(account: string | null): number {
  if (!account) return 1;
  const saved = Number(Storage.getItemSync(rateKey(account)));
  return (voiceRates as readonly number[]).includes(saved) ? saved : 1;
}

let played: { account: string | null; ids: Set<string>; version: number } = { account: null, ids: new Set(), version: 0 };
const playedListeners = new Set<() => void>();

function playedFor(account: string | null) {
  if (played.account === account) return played;
  let ids: string[] = [];
  try {
    const raw = account ? JSON.parse(Storage.getItemSync(playedKey(account)) ?? '[]') : [];
    ids = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    ids = [];
  }
  played = { account, ids: new Set(ids), version: played.version + 1 };
  return played;
}

export function markPlayed(id: string) {
  const account = activeAccount();
  const book = playedFor(account);
  if (book.ids.has(id) || !account) return;
  const ids = [...book.ids, id].slice(-playedLimit);
  played = { account, ids: new Set(ids), version: book.version + 1 };
  Storage.setItemSync(playedKey(account), JSON.stringify(ids));
  playedListeners.forEach((listener) => listener());
}

export function isPlayed(id: string): boolean {
  return playedFor(activeAccount()).ids.has(id);
}

export function usePlayed(id: string): boolean {
  useSyncExternalStore(
    (listener) => {
      playedListeners.add(listener);
      return () => playedListeners.delete(listener);
    },
    () => playedFor(activeAccount()).version,
  );
  return isPlayed(id);
}

onAccountForgotten((account) => {
  Storage.removeItemSync(rateKey(account));
  Storage.removeItemSync(playedKey(account));
  if (played.account === account) played = { account: null, ids: new Set(), version: played.version + 1 };
  positions.clear();
  releaseCurrent();
});

function keepPosition() {
  if (state.id && state.position > 0 && state.position < state.duration) positions.set(state.id, state.position);
}

function setLockScreen(active: boolean) {
  if (!player || active === lockScreen) return;
  try {
    if (active) player.setActiveForLockScreen(true, { title: state.meta?.title ?? '', artist: 'Kaitech' });
    else player.setActiveForLockScreen(false);
    lockScreen = active;
  } catch {
    lockScreen = false;
  }
}

function onStatus(status: AudioStatus) {
  const duration = status.duration * 1000 || state.duration;
  if (status.isLoaded && (pendingFraction !== null || pendingPosition !== null) && duration > 0) {
    const target = pendingPosition ?? (pendingFraction as number) * duration;
    pendingFraction = null;
    pendingPosition = null;
    void player?.seekTo(target / 1000);
  }
  if (startWhenLoaded && status.isLoaded) {
    startWhenLoaded = false;
    if (!status.playing) player?.play();
  }
  const position = status.currentTime * 1000;
  if (status.didJustFinish) {
    const finished = state.id;
    if (finished) positions.delete(finished);
    set({ playing: false, position: 0, duration, loading: false });
    player?.pause();
    void player?.seekTo(0);
    setLockScreen(false);
    if (finished) playNextAfter(finished);
    return;
  }
  set({ playing: status.playing, position, duration, loading: status.isBuffering && !status.playing });
  setLockScreen(status.playing);
}

function playNextAfter(id: string) {
  const next = nextOf?.(id);
  if (!next) return;
  if (nextTimer) clearTimeout(nextTimer);
  nextTimer = setTimeout(() => {
    nextTimer = null;
    if (state.id !== id || state.playing) return;
    void Haptics.selectionAsync().catch(() => undefined);
    void toggleVoice(next.id, next.uri, next.headers, next.meta);
  }, nextVoiceDelayMs);
}

export function setVoiceNext(next: ((id: string) => VoiceSource | null) | null): () => void {
  nextOf = next;
  return () => {
    if (nextOf === next) nextOf = null;
  };
}

export function useVoice(): VoiceState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export function voiceState(): VoiceState {
  return state;
}

async function load(id: string, uri: string, headers?: Record<string, string>, meta?: VoiceMeta): Promise<AudioPlayer> {
  keepPosition();
  if (nextTimer) clearTimeout(nextTimer);
  nextTimer = null;
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: meetingRecording(), shouldPlayInBackground: true, interruptionMode: 'doNotMix' });
  setLockScreen(false);
  subscription?.remove();
  player?.remove();
  const made = createAudioPlayer({ uri, headers }, { updateInterval: 250 });
  player = made;
  const rate = rateFor(activeAccount());
  made.setPlaybackRate(rate);
  subscription = made.addListener('playbackStatusUpdate', onStatus);
  pendingPosition = positions.get(id) ?? null;
  pendingFraction = null;
  set({ id, playing: false, position: pendingPosition ?? 0, duration: 0, loading: true, rate, meta: meta ?? null });
  return made;
}

export async function toggleVoice(id: string, uri: string, headers?: Record<string, string>, meta?: VoiceMeta) {
  if (state.id === id && player) {
    startWhenLoaded = false;
    if (state.playing) {
      player.pause();
      keepPosition();
    } else player.play();
    return;
  }
  const made = await load(id, uri, headers, meta);
  markPlayed(id);
  startWhenLoaded = true;
  made.play();
}

export async function seekVoice(id: string, uri: string, positionMs: number, headers?: Record<string, string>) {
  const target = Math.max(0, positionMs);
  if (state.id === id && player) {
    await player.seekTo(target / 1000);
    set({ position: target });
    return;
  }
  await load(id, uri, headers);
  pendingPosition = target;
  set({ position: target });
}

export async function seekVoiceFraction(id: string, uri: string, fraction: number, headers?: Record<string, string>, meta?: VoiceMeta) {
  const part = Math.min(1, Math.max(0, fraction));
  if (state.id === id && player && state.duration > 0) {
    await seekVoice(id, uri, part * state.duration);
    return;
  }
  await load(id, uri, headers, meta);
  pendingPosition = null;
  pendingFraction = part;
}

function releaseCurrent() {
  startWhenLoaded = false;
  setLockScreen(false);
  subscription?.remove();
  subscription = null;
  player?.remove();
  player = null;
  set({ id: null, playing: false, position: 0, duration: 0, loading: false, meta: null });
}

export function releaseVoice(id: string) {
  if (state.id !== id) return;
  releaseCurrent();
}

export function closeVoice() {
  keepPosition();
  releaseCurrent();
}

export function cycleVoiceRate() {
  const next = voiceRates[(voiceRates.indexOf(state.rate as (typeof voiceRates)[number]) + 1) % voiceRates.length];
  player?.setPlaybackRate(next);
  const account = activeAccount();
  if (account) Storage.setItemSync(rateKey(account), String(next));
  set({ rate: next });
}

export function stopVoice() {
  player?.pause();
  keepPosition();
  set({ playing: false });
}
