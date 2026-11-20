import { useSyncExternalStore } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import i18n from '../../i18n';
import { getSession, onAccountForgotten } from '../../auth/session';
import type { Account } from '../../auth/oauth';
import { conversationById, getChat } from '../chat/chat';
import { CallClient, type Joined, type SessionValues } from './api';
import { loadClient, loadLiveKit, type LiveParticipant, type LiveRoom } from './livekit';
import { callNative, onCallAction, type CallAction } from './native';
import { invitationChannels, invitationsFrom, sessionIdsFrom, type Invitation } from './odoo';
import { ensureCamera, ensureMicrophone } from './permissions';

export type CallPhase = 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active' | 'reconnecting' | 'ended';

export type CallPerson = {
  sid: string;
  name: string;
  partnerId: number | null;
  local: boolean;
  speaking: boolean;
  cameraOn: boolean;
  micOn: boolean;
};

export type CallState = {
  phase: CallPhase;
  channelId: number;
  channelName: string;
  video: boolean;
  muted: boolean;
  cameraOn: boolean;
  speaker: boolean;
  facing: 'user' | 'environment';
  callerName: string;
  callerPartnerId: number | null;
  callId: number;
  startedAt: number;
  endedReason: string | null;
  ringing: boolean;
  people: CallPerson[];
  speaking: string[];
  version: number;
};

const idle: CallState = {
  phase: 'idle',
  channelId: 0,
  channelName: '',
  video: false,
  muted: false,
  cameraOn: false,
  speaker: true,
  facing: 'user',
  callerName: '',
  callerPartnerId: null,
  callId: 0,
  startedAt: 0,
  endedReason: null,
  ringing: false,
  people: [],
  speaking: [],
  version: 0,
};

let state: CallState = idle;
const listeners = new Set<() => void>();
let client: CallClient | null = null;
let room: LiveRoom | null = null;
let joined: Joined | null = null;
let known = new Set<number>();
let pingTimer: ReturnType<typeof setInterval> | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;
const tracks = new Map<string, unknown>();

export function callState(): CallState {
  return state;
}

export function subscribeCall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCallState(): CallState {
  return useSyncExternalStore(subscribeCall, callState, callState);
}

function publish(next: Partial<CallState>) {
  state = { ...state, ...next, version: state.version + 1 };
  listeners.forEach((listener) => listener());
}

export function videoTrack(sid: string, source: 'camera' | 'screen' = 'camera') {
  return tracks.get(`${sid}|${source}`) ?? null;
}

export function startAccount(account: Account) {
  client = new CallClient(account);
  if (state.phase === 'idle') void lookForInvitations(null, { ring: true });
}

export function stopAccount() {
  void hangUp('signedOut');
  client = null;
}

function activeAccount(): Account | null {
  const session = getSession();
  return session.accounts.find((item) => item.id === session.activeId) ?? null;
}

export function callClient(): CallClient | null {
  if (client) return client;
  const account = activeAccount();
  if (!account) return null;
  client = new CallClient(account);
  return client;
}

function collectTracks() {
  tracks.clear();
  if (!room) return;
  const add = (participant: LiveParticipant) => {
    for (const publication of participant.trackPublications.values()) {
      if (!publication.videoTrack) continue;
      const source = publication.source === 'screen_share' ? 'screen' : 'camera';
      tracks.set(`${participant.sid}|${source}`, { participant, publication, source: publication.source });
    }
  };
  add(room.localParticipant);
  for (const participant of room.remoteParticipants.values()) add(participant);
}

function partnerOf(participant: { name?: string; identity: string }, local: boolean): number | null {
  if (local) return activeAccount()?.partnerId ?? null;
  const conversation = conversationById(getChat(), state.channelId);
  if (conversation?.type !== 'chat') return null;
  const others = room ? room.remoteParticipants.size : 0;
  return others === 1 ? conversation.partnerId : null;
}

function collectPeople() {
  if (!room) {
    publish({ people: [], speaking: [] });
    return;
  }
  const speakers = new Set(room.activeSpeakers.map((participant) => participant.sid));
  const local = room.localParticipant;
  const rows = [local, ...room.remoteParticipants.values()].map((participant) => ({
    sid: participant.sid,
    name: participant.name || participant.identity,
    partnerId: partnerOf(participant, participant === local),
    local: participant === local,
    speaking: speakers.has(participant.sid),
    cameraOn: participant.isCameraEnabled,
    micOn: participant.isMicrophoneEnabled,
  }));
  publish({ people: rows, speaking: [...speakers] });
}

function collect() {
  collectTracks();
  collectPeople();
}

export async function startCall(input: { channelId: number; channelName: string; video: boolean }) {
  if (state.phase !== 'idle' && state.phase !== 'ended') return;
  const api = callClient();
  if (!api) return;
  if (!(await ensureMicrophone())) {
    publish({ ...idle, phase: 'ended', endedReason: 'microphone', version: state.version + 1 });
    scheduleIdle();
    return;
  }
  if (input.video && !(await ensureCamera())) {
    publish({ ...idle, phase: 'ended', endedReason: 'camera', version: state.version + 1 });
    scheduleIdle();
    return;
  }
  publish({
    ...idle,
    phase: 'outgoing',
    channelId: input.channelId,
    channelName: input.channelName,
    video: input.video,
    cameraOn: input.video,
    speaker: true,
    version: state.version + 1,
  });
  await connect(api, input.channelId, input.video);
}

export async function answer() {
  if (state.phase !== 'incoming') return;
  const api = callClient();
  if (!api) return;
  stopRinging();
  if (!(await ensureMicrophone())) {
    publish({ phase: 'ended', endedReason: 'microphone', ringing: false });
    scheduleIdle();
    await api.decline(state.channelId).catch(() => undefined);
    return;
  }
  const video = state.video && (await ensureCamera());
  publish({ phase: 'connecting', video, cameraOn: video, ringing: false });
  await connect(api, state.channelId, video);
}

export async function decline() {
  if (state.phase !== 'incoming') return;
  const api = callClient();
  const channelId = state.channelId;
  stopRinging();
  publish({ phase: 'ended', ringing: false, endedReason: 'declined' });
  scheduleIdle();
  await api?.decline(channelId).catch(() => undefined);
}

async function connect(api: CallClient, channelId: number, video: boolean) {
  try {
    const sdk = await loadClient();
    const livekit = await loadLiveKit();
    const session = await api.join(channelId, video);
    joined = session;
    known = new Set([session.sessionId]);
    const instance = new sdk.Room({ adaptiveStream: true, dynacast: true });
    room = instance;
    bind(instance, sdk);
    await livekit.AudioSession.startAudioSession();
    await instance.connect(session.url, session.token);
    await instance.localParticipant.setMicrophoneEnabled(true);
    if (video) await instance.localParticipant.setCameraEnabled(true);
    await routeAudio(video);
    collect();
    publish({ phase: 'active', startedAt: Date.now(), muted: false, cameraOn: video, speaker: true });
    callNative()?.setInCall(true);
    callNative()?.startCall({ video, title: state.channelName || state.callerName, body: i18n.t('call:inCall'), channelId });
    startPing(api);
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'call_failed';
    const session = joined;
    await teardown();
    publish({ phase: 'ended', endedReason: code });
    if (session) await api.leave(session.channelId, session.sessionId).catch(() => undefined);
    scheduleIdle();
  }
}

function bind(instance: LiveRoom, sdk: Awaited<ReturnType<typeof loadClient>>) {
  const event = sdk.RoomEvent;
  const handlers: [string, () => void][] = [
    [event.ParticipantConnected, collect],
    [event.ParticipantDisconnected, collect],
    [event.TrackSubscribed, collect],
    [event.TrackUnsubscribed, collect],
    [event.TrackMuted, collect],
    [event.TrackUnmuted, collect],
    [event.LocalTrackPublished, collect],
    [event.LocalTrackUnpublished, collect],
    [event.ActiveSpeakersChanged, collect],
    [event.Reconnecting, () => publish({ phase: 'reconnecting' })],
    [event.Reconnected, () => publish({ phase: 'active' })],
    [event.Disconnected, () => void finish('disconnected')],
  ];
  for (const [name, handler] of handlers) instance.on(name as never, handler as never);
}

function startPing(api: CallClient) {
  stopPing();
  const tick = async () => {
    if (!joined || !room) return;
    const session = joined;
    try {
      const store = await api.ping(session.channelId, session.sessionId, [...known]);
      const change = sessionIdsFrom(store, session.channelId);
      for (const id of change.added) known.add(id);
      for (const id of change.removed) known.delete(id);
      if (change.added.length || change.removed.length) collectPeople();
      if (change.removed.includes(session.sessionId)) void finish('removed');
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
      if (code === 'not_found' || code === 'forbidden') void finish('removed');
    }
  };
  void tick();
  pingTimer = setInterval(() => void tick(), 30_000);
}

function stopPing() {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
}

export async function hangUp(reason = 'left') {
  if (state.phase === 'idle') {
    reset();
    return;
  }
  await finish(reason);
}

async function finish(reason: string) {
  if (state.phase === 'ended' || state.phase === 'idle') return;
  const api = client;
  const session = joined;
  stopRinging();
  stopPing();
  publish({ phase: 'ended', endedReason: reason });
  await teardown();
  if (api && session) await api.leave(session.channelId, session.sessionId).catch(() => undefined);
  scheduleIdle();
}

async function teardown() {
  callNative()?.setInCall(false);
  callNative()?.stopCall();
  const held = room;
  room = null;
  joined = null;
  tracks.clear();
  if (held) await held.disconnect().catch(() => undefined);
  try {
    const livekit = await loadLiveKit();
    await livekit.AudioSession.stopAudioSession();
  } catch {
    return;
  }
  collectPeople();
}

function scheduleIdle() {
  if (endTimer) clearTimeout(endTimer);
  endTimer = setTimeout(reset, 2400);
}

function reset() {
  if (endTimer) clearTimeout(endTimer);
  endTimer = null;
  stopRinging();
  stopPing();
  tracks.clear();
  state = { ...idle, version: state.version + 1 };
  listeners.forEach((listener) => listener());
}

export async function toggleMute() {
  if (!room) return;
  const next = !state.muted;
  await room.localParticipant.setMicrophoneEnabled(!next).catch(() => undefined);
  publish({ muted: next });
  void send({ is_muted: next });
  presence();
}

export async function toggleCamera() {
  if (!room) return;
  const next = !state.cameraOn;
  if (next && !(await ensureCamera())) return;
  await room.localParticipant.setCameraEnabled(next).catch(() => undefined);
  publish({ cameraOn: next, video: state.video || next });
  void send({ is_camera_on: next });
  presence();
}

export async function flipCamera() {
  const participant = room?.localParticipant;
  if (!participant) return;
  for (const publication of participant.trackPublications.values()) {
    const track = publication.videoTrack as { switchCamera?: () => Promise<void> | void } | undefined;
    if (track?.switchCamera) await track.switchCamera();
  }
  publish({ facing: state.facing === 'user' ? 'environment' : 'user' });
}

export async function toggleSpeaker() {
  const next = !state.speaker;
  await routeAudio(next ? state.video : !state.video).catch(() => undefined);
  publish({ speaker: next });
}

async function routeAudio(speaker: boolean) {
  try {
    const livekit = await loadLiveKit();
    const outputs = await livekit.AudioSession.getAudioOutputs();
    const wanted = speaker ? (outputs.includes('speaker') ? 'speaker' : 'force_speaker') : outputs.includes('earpiece') ? 'earpiece' : 'default';
    if (outputs.includes(wanted)) await livekit.AudioSession.selectAudioOutput(wanted);
  } catch {
    return;
  }
}

function send(values: SessionValues) {
  if (!client || !joined) return Promise.resolve();
  return client.update(joined.sessionId, values).catch(() => undefined);
}

function presence() {
  if (!joined) return;
  callNative()?.updateCall({
    video: state.video,
    title: state.channelName || state.callerName,
    body: i18n.t('call:inCall'),
    channelId: state.channelId,
    muted: state.muted,
    camera: state.cameraOn,
  });
}

export function enterPictureInPicture(): Promise<boolean> {
  return Promise.resolve(callNative()?.enterPictureInPicture() ?? false);
}

export function pictureInPictureSupported(): boolean {
  return callNative()?.isPictureInPictureSupported() ?? false;
}

export function setLocked(locked: boolean) {
  callNative()?.setLocked(locked);
}

function stopRinging() {
  Vibration.cancel();
  callNative()?.cancelRing(state.channelId);
  if (state.ringing) publish({ ringing: false });
}

async function lookForInvitations(channelId: number | null, options: { ring: boolean } = { ring: false }): Promise<Invitation[]> {
  const api = callClient();
  const account = activeAccount();
  if (!api || !account) return [];
  if (state.phase !== 'idle' && state.phase !== 'ended' && state.phase !== 'incoming') return [];
  try {
    const store = await api.invitations(channelId);
    const found = invitationsFrom(store, account.partnerId);
    if (!found.length) {
      if (state.phase === 'incoming') reset();
      return [];
    }
    if (state.phase === 'incoming' && found[0].channelId === state.channelId) {
      publish({ callId: found[0].callId, callerName: found[0].callerName, video: found[0].video });
      return found;
    }
    if (state.phase === 'idle' || state.phase === 'ended') {
      ring(found[0]);
      if (options.ring) inAppRing();
    }
    return found;
  } catch {
    return [];
  }
}

function ring(invitation: Invitation) {
  publish({
    ...idle,
    phase: 'incoming',
    channelId: invitation.channelId,
    channelName: invitation.channelName,
    callerName: invitation.callerName,
    callerPartnerId: invitation.callerPartnerId,
    callId: invitation.callId,
    video: invitation.video,
    version: state.version + 1,
  });
}

function inAppRing() {
  if (Platform.OS === 'android' && callNative()) return;
  Vibration.cancel();
  Vibration.vibrate([0, 900, 900], true);
}

export function onNotification(type: string, payload: unknown) {
  for (const channelId of invitationChannels(type, payload)) void lookForInvitations(channelId);
}

function fromNative(action: CallAction) {
  if (action.type === 'decline') {
    if (state.phase === 'incoming' && (!action.channelId || action.channelId === state.channelId)) void decline();
    else void callClient()?.decline(action.channelId ?? state.channelId).catch(() => undefined);
    return;
  }
  if (action.type === 'hangup') {
    void hangUp('left');
    return;
  }
  if (action.type === 'cancel') {
    if (state.phase === 'incoming' && (!action.channelId || action.channelId === state.channelId)) reset();
    return;
  }
  void takeLaunch(action);
}

async function takeLaunch(action: CallAction) {
  if (action.type !== 'incoming' && action.type !== 'answer' && action.type !== 'open') return;
  if (!action.channelId) return;
  const found = await lookForInvitations(action.channelId, { ring: action.type === 'open' });
  if (!found.length) return;
  if (action.type === 'answer' && state.phase === 'incoming') await answer();
}

onCallAction(fromNative);

void (async () => {
  const native = callNative();
  if (!native) return;
  const pending = await native.takePending().catch(() => []);
  for (const action of pending) fromNative(action);
  const launch = await native.takeLaunchAction().catch(() => null);
  if (launch) fromNative(launch);
})();

AppState.addEventListener('change', (next) => {
  if (next !== 'active') return;
  const native = callNative();
  if (!native) return;
  void native
    .takeLaunchAction()
    .then((launch) => {
      if (launch) fromNative(launch);
    })
    .catch(() => undefined);
});

onAccountForgotten((id) => {
  if (activeAccount()?.id === id) stopAccount();
});
