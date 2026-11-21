import { useSyncExternalStore } from 'react';
import { AppState, Vibration } from 'react-native';
import i18n from '../../i18n';
import { getSession, onAccountForgotten } from '../../auth/session';
import type { Account } from '../../auth/oauth';
import { conversationById, getChat, invitedChannels } from '../chat/chat';
import { CallClient, type Joined, type SessionValues } from './api';
import { loadClient, loadLiveKit, type LiveParticipant, type LiveRoom } from './livekit';
import { callNative, onCallAction, type CallAction } from './native';
import { invitationChannels, invitationsFrom, peopleFrom, sessionIdsFrom, type Invitation } from './odoo';
import { notePhotos } from '../people/photos';
import { ensureCamera, ensureMicrophone } from './permissions';
import { accountFromPush } from './account';
import { pickBroadcast } from './screenShare';
import { currentRecording, startRecording, stopRecording } from './recording';
import { pipFocus, pipSpec, type PipSpec } from './pip';
import { loadVolumes, saveVolume } from './volumes';
import { onPictureInPictureAllowedChange, pictureInPictureAllowed } from './pipSetting';

export type CallPhase = 'idle' | 'incoming' | 'outgoing' | 'connecting' | 'active' | 'reconnecting' | 'ended';

export type CallPerson = {
  sid: string;
  name: string;
  partnerId: number | null;
  local: boolean;
  speaking: boolean;
  cameraOn: boolean;
  micOn: boolean;
  screenOn: boolean;
  hand: boolean;
  deaf: boolean;
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
  answering: boolean;
  screenSharing: boolean;
  recording: boolean;
  recordingBy: string | null;
  recordingBusy: boolean;
  recordingError: string | null;
  people: CallPerson[];
  speaking: string[];
  focus: { sid: string; source: 'camera' | 'screen' } | null;
  pictureInPicture: boolean;
  deaf: boolean;
  hand: boolean;
  videoOnly: boolean;
  output: string | null;
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
  answering: false,
  screenSharing: false,
  recording: false,
  recordingBy: null,
  recordingBusy: false,
  recordingError: null,
  people: [],
  speaking: [],
  focus: null,
  pictureInPicture: false,
  deaf: false,
  hand: false,
  videoOnly: false,
  output: null,
  version: 0,
};

let state: CallState = idle;
const listeners = new Set<() => void>();
let client: CallClient | null = null;
let room: LiveRoom | null = null;
let joined: Joined | null = null;
let known = new Set<number>();
let sessionPartners = new Map<number, number>();
let pingTimer: ReturnType<typeof setInterval> | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;
let callAccount: Account | null = null;
let sharingBusy = false;
let shareStarting = false;
const tracks = new Map<string, unknown>();
let volumes = new Map<number, number>();
const tuned = new Set<string>();

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
  const merged = { ...state, ...next };
  const found = pipFocus(merged.people, merged.speaking, state.focus?.sid ?? null);
  const focus = found ? { sid: found.person.sid, source: found.source } : null;
  const same = focus && state.focus && focus.sid === state.focus.sid && focus.source === state.focus.source;
  state = { ...merged, focus: same ? state.focus : focus, pictureInPicture: next.pictureInPicture ?? state.pictureInPicture, version: state.version + 1 };
  listeners.forEach((listener) => listener());
}

function stale(started: number): boolean {
  return started !== generation || state.phase === 'ended';
}

export function videoTrack(sid: string, source: 'camera' | 'screen' = 'camera') {
  return tracks.get(`${sid}|${source}`) ?? null;
}

export function startAccount(account: Account) {
  client = new CallClient(account);
  if (state.phase === 'idle') void lookForInvitations(null);
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

function clientFor(account: Account | null): CallClient | null {
  if (!account) return null;
  if (client && client.account.id === account.id) return client;
  return new CallClient(account);
}

function sessionClient(): CallClient | null {
  return clientFor(callAccount) ?? callClient();
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

function partnerOf(participant: LiveParticipant, local: boolean): number | null {
  if (local) return (callAccount ?? activeAccount())?.partnerId ?? null;
  const fromSession = sessionPartners.get(Number(participant.identity));
  if (fromSession) return fromSession;
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
  for (const participant of room.remoteParticipants.values()) {
    const partner = partnerOf(participant, false);
    const volume = partner === null ? undefined : volumes.get(partner);
    if (volume === undefined || tuned.has(participant.sid)) continue;
    participant.setVolume(volume);
    tuned.add(participant.sid);
  }
  const rows = [local, ...room.remoteParticipants.values()].map((participant) => ({
    sid: participant.sid,
    name: participant.name || participant.identity,
    partnerId: partnerOf(participant, participant === local),
    local: participant === local,
    speaking: speakers.has(participant.sid),
    cameraOn: participant.isCameraEnabled,
    micOn: participant.isMicrophoneEnabled,
    screenOn: participant.isScreenShareEnabled,
    hand: participant.attributes?.hand === '1',
    deaf: participant.attributes?.deaf === '1',
  }));
  publish({ people: rows, speaking: [...speakers] });
}

function collectSpeaking() {
  if (!room) return;
  const speakers = new Set(room.activeSpeakers.map((participant) => participant.sid));
  if (!state.people.some((person) => person.speaking !== speakers.has(person.sid))) return;
  publish({
    speaking: [...speakers],
    people: state.people.map((person) => ({ ...person, speaking: speakers.has(person.sid) })),
  });
}

function collect() {
  collectTracks();
  collectPeople();
  syncScreen();
}

function syncScreen() {
  const sharing = Boolean(room?.localParticipant.isScreenShareEnabled);
  if (sharing === state.screenSharing) return;
  publish({ screenSharing: sharing });
  void send({ is_screen_sharing_on: sharing });
  presence();
}

function syncRecording() {
  const recording = Boolean(room?.isRecording);
  if (recording === state.recording) return;
  publish({ recording, recordingBy: recording ? state.recordingBy : null });
  if (recording) void lookUpRecorder();
}

async function lookUpRecorder() {
  const account = callAccount;
  const session = joined;
  if (!account || !session) return;
  const found = await currentRecording(account, session.channelId).catch(() => null);
  if (joined === session && state.recording && found) publish({ recordingBy: found.startedBy });
}

function errorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'network';
}

export async function toggleRecording() {
  const account = callAccount;
  const session = joined;
  if (!account || !session || state.recordingBusy || state.phase !== 'active') return;
  const stopping = state.recording;
  publish({ recordingBusy: true, recordingError: null });
  try {
    const found = stopping ? await stopRecording(account, session.channelId) : await startRecording(account, session.channelId);
    if (joined === session && found && !stopping) publish({ recordingBy: found.startedBy });
  } catch (error) {
    if (joined === session) publish({ recordingError: errorCode(error) });
  } finally {
    if (joined === session) publish({ recordingBusy: false });
  }
}

export async function startCall(input: { channelId: number; channelName: string; video: boolean }) {
  if (state.phase !== 'idle' && state.phase !== 'ended') return;
  const api = callClient();
  if (!api) return;
  const started = ++generation;
  callAccount = api.account;
  if (!(await ensureMicrophone())) {
    if (started === generation) {
      publish({ ...idle, phase: 'ended', endedReason: 'microphone', version: state.version + 1 });
      scheduleIdle();
    }
    return;
  }
  if (stale(started)) return;
  if (input.video && !(await ensureCamera())) {
    if (started === generation) {
      publish({ ...idle, phase: 'ended', endedReason: 'camera', version: state.version + 1 });
      scheduleIdle();
    }
    return;
  }
  if (stale(started)) return;
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
  await connect(api, input.channelId, input.video, started);
}

export async function answer(camera = state.video) {
  if (state.phase !== 'incoming') return;
  const api = sessionClient();
  if (!api) return;
  const started = generation;
  stopRinging();
  publish({ answering: true });
  if (!(await ensureMicrophone())) {
    if (stale(started)) return;
    publish({ phase: 'ended', endedReason: 'microphone', ringing: false });
    scheduleIdle();
    await api.decline(state.channelId).catch(() => undefined);
    return;
  }
  if (stale(started)) return;
  const video = camera && (await ensureCamera());
  if (stale(started)) return;
  publish({ phase: 'connecting', video, cameraOn: video, ringing: false });
  await connect(api, state.channelId, video, started);
}

export async function decline() {
  if (state.phase !== 'incoming') return;
  const api = sessionClient();
  const channelId = state.channelId;
  generation += 1;
  stopRinging();
  publish({ phase: 'ended', ringing: false, endedReason: 'declined' });
  scheduleIdle();
  await api?.decline(channelId).catch(() => undefined);
}

async function connect(api: CallClient, channelId: number, video: boolean, started: number) {
  try {
    const sdk = await loadClient();
    const livekit = await loadLiveKit();
    const session = await api.join(channelId, video);
    if (stale(started)) {
      await api.leave(session.channelId, session.sessionId).catch(() => undefined);
      return;
    }
    joined = session;
    known = new Set([session.sessionId]);
    sessionPartners = new Map();
    const instance = new sdk.Room({ adaptiveStream: true, dynacast: true, singlePeerConnection: false });
    room = instance;
    bind(instance, sdk);
    await livekit.AudioSession.startAudioSession();
    await instance.connect(session.url, session.token);
    if (stale(started)) {
      await teardown();
      await api.leave(session.channelId, session.sessionId).catch(() => undefined);
      return;
    }
    await instance.localParticipant.setMicrophoneEnabled(true);
    if (video) await instance.localParticipant.setCameraEnabled(true);
    await routeAudio(video);
    if (stale(started)) {
      await teardown();
      await api.leave(session.channelId, session.sessionId).catch(() => undefined);
      return;
    }
    collect();
    publish({ phase: 'active', startedAt: Date.now(), muted: false, cameraOn: video, speaker: true, recording: instance.isRecording });
    if (instance.isRecording) void lookUpRecorder();
    void callNative()?.setInCall(true);
    void callNative()?.startCall(video, state.channelName || state.callerName, i18n.t('call:inCall'), channelId);
    startPing(api, started);
    void loadVolumes(api.account)
      .then((saved) => {
        if (stale(started)) return;
        volumes = saved;
        tuned.clear();
        collectPeople();
      })
      .catch(() => undefined);
  } catch (error) {
    if (started !== generation) return;
    const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : 'call_failed';
    const session = joined;
    await teardown();
    if (started !== generation) return;
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
    [event.TrackSubscribed, () => {
      applyDeaf();
      collect();
    }],
    [event.ParticipantAttributesChanged, collectPeople],
    [event.TrackUnsubscribed, collect],
    [event.TrackMuted, collect],
    [event.TrackUnmuted, collect],
    [event.LocalTrackPublished, collect],
    [event.LocalTrackUnpublished, collect],
    [event.ActiveSpeakersChanged, collectSpeaking],
    [event.RecordingStatusChanged, syncRecording],
    [event.Reconnecting, () => publish({ phase: 'reconnecting' })],
    [event.Reconnected, () => publish({ phase: 'active' })],
    [event.Disconnected, () => void finish('disconnected')],
  ];
  for (const [name, handler] of handlers) instance.on(name as never, handler as never);
}

function startPing(api: CallClient, started: number) {
  stopPing();
  const tick = async () => {
    if (!joined || !room || started !== generation) return;
    const session = joined;
    try {
      const store = await api.ping(session.channelId, session.sessionId, [...known]);
      const change = sessionIdsFrom(store, session.channelId);
      const learned = absorbPeople(store);
      for (const id of change.added) known.add(id);
      for (const id of change.removed) known.delete(id);
      if (change.added.length || change.removed.length || learned) collectPeople();
      if (change.removed.includes(session.sessionId)) void finish('removed');
    } catch (error) {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String((error as { code: unknown }).code) : '';
      if (code === 'not_found' || code === 'forbidden') void finish('removed');
    }
  };
  void tick();
  pingTimer = setInterval(() => void tick(), 30_000);
}

function absorbPeople(store: unknown): boolean {
  notePhotos((callAccount ?? activeAccount())?.id ?? null, store);
  let learned = false;
  for (const [sessionId, person] of peopleFrom(store)) {
    if (!person.partnerId || sessionPartners.get(sessionId) === person.partnerId) continue;
    sessionPartners.set(sessionId, person.partnerId);
    learned = true;
  }
  return learned;
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
  generation += 1;
  const api = clientFor(callAccount) ?? client;
  const session = joined;
  stopRinging();
  stopPing();
  publish({ phase: 'ended', endedReason: reason });
  await teardown();
  if (api && session) await api.leave(session.channelId, session.sessionId).catch(() => undefined);
  scheduleIdle();
}

async function teardown() {
  void callNative()?.setInCall(false);
  void callNative()?.stopCall();
  const held = room;
  room = null;
  joined = null;
  tracks.clear();
  tuned.clear();
  if (held) {
    const local = held.localParticipant;
    if (local.isScreenShareEnabled) await local.setScreenShareEnabled(false).catch(() => undefined);
    await local.setMicrophoneEnabled(false).catch(() => undefined);
    await held.disconnect().catch(() => undefined);
  }
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
  generation += 1;
  stopRinging();
  stopPing();
  callAccount = null;
  state = { ...idle, pictureInPicture: state.pictureInPicture, version: state.version + 1 };
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

export function toggleScreenShare(): Promise<void> {
  return setScreenShare(!state.screenSharing);
}

async function setScreenShare(on: boolean) {
  const instance = room;
  if (!instance || sharingBusy || state.phase !== 'active') return;
  sharingBusy = true;
  if (on) {
    shareStarting = true;
    presence();
  }
  try {
    if (on && !(await pickBroadcast())) return;
    if (room !== instance) return;
    await instance.localParticipant.setScreenShareEnabled(on);
  } catch {
    return;
  } finally {
    sharingBusy = false;
    shareStarting = false;
    if (room === instance) collect();
    if (on && !state.screenSharing) presence();
  }
}

function tell(changes: Record<string, string>) {
  const participant = room?.localParticipant;
  if (!participant) return;
  void participant.setAttributes({ ...participant.attributes, ...changes }).catch(() => undefined);
}

function applyDeaf() {
  if (!room) return;
  for (const participant of room.remoteParticipants.values()) {
    for (const publication of participant.audioTrackPublications.values()) publication.setEnabled(!state.deaf);
  }
}

export function toggleHand() {
  if (!room || state.phase !== 'active') return;
  const next = !state.hand;
  publish({ hand: next });
  tell({ hand: next ? '1' : '0' });
  collectPeople();
}

export function toggleDeafen() {
  if (!room || state.phase !== 'active') return;
  const next = !state.deaf;
  publish({ deaf: next });
  applyDeaf();
  tell({ deaf: next ? '1' : '0' });
  void send({ is_deaf: next });
  collectPeople();
}

export function toggleVideoOnly() {
  publish({ videoOnly: !state.videoOnly });
}

export function personVolume(partnerId: number | null): number {
  return partnerId === null ? 1 : (volumes.get(partnerId) ?? 1);
}

export function setPersonVolume(sid: string, volume: number) {
  const participant = room ? [...room.remoteParticipants.values()].find((item) => item.sid === sid) : undefined;
  if (!participant) return;
  const level = Math.max(0, Math.min(1, volume));
  participant.setVolume(level);
  tuned.add(sid);
  const partner = partnerOf(participant, false);
  if (partner === null) return;
  volumes.set(partner, level);
  if (callAccount) void saveVolume(callAccount, partner, level).catch(() => undefined);
}

export async function audioOutputs(): Promise<string[]> {
  try {
    return await (await loadLiveKit()).AudioSession.getAudioOutputs();
  } catch {
    return [];
  }
}

export async function chooseAudioOutput(output: string) {
  try {
    await (await loadLiveKit()).AudioSession.selectAudioOutput(output);
    publish({ output, speaker: output === 'speaker' || output === 'force_speaker' });
  } catch {
    return;
  }
}

function send(values: SessionValues) {
  const api = sessionClient();
  if (!api || !joined) return Promise.resolve();
  return api.update(joined.sessionId, values).catch(() => undefined);
}

function presence() {
  if (!joined) return;
  void callNative()?.updateCall(
    state.video,
    state.screenSharing || shareStarting ? i18n.t('call:sharingTitle') : state.channelName || state.callerName,
    i18n.t(state.screenSharing ? 'call:sharingScreen' : 'call:inCall'),
    state.channelId,
    state.muted,
    state.cameraOn,
    state.screenSharing,
  );
}

export function enterPictureInPicture(): Promise<boolean> {
  return callNative()?.enterPictureInPicture().catch(() => false) ?? Promise.resolve(false);
}

export function pictureInPictureSupported(): boolean {
  return Boolean(callNative()?.pictureInPictureSupported);
}

function trackDimensions(sid: string, source: 'camera' | 'screen') {
  const held = tracks.get(`${sid}|${source}`) as { publication?: { dimensions?: { width: number; height: number } } } | undefined;
  return held?.publication?.dimensions ?? null;
}

export function pictureInPictureSpec(current: CallState = state): PipSpec {
  const person = current.focus ? current.people.find((item) => item.sid === current.focus?.sid) ?? null : null;
  const focus = person && current.focus ? { person, source: current.focus.source } : null;
  return pipSpec({
    allowed: pictureInPictureAllowed(),
    phase: current.phase,
    video: current.video,
    muted: current.muted,
    cameraOn: current.cameraOn,
    screenSharing: current.screenSharing,
    people: current.people,
    focus,
    dimensions: focus ? trackDimensions(focus.person.sid, focus.source) : null,
  });
}

let pipKey = '';
let hintKey = '';

function syncPictureInPicture() {
  const native = callNative();
  if (!native) return;
  if (state.phase === 'idle' && state.pictureInPicture) void native.leavePictureInPicture().catch(() => false);
  const spec = pictureInPictureSpec();
  const key = JSON.stringify(spec);
  if (key === pipKey) return;
  pipKey = key;
  void native.setPictureInPicture(spec.enabled, spec.width, spec.height, spec.muted, spec.camera, spec.video, spec.sharing).catch(() => false);
}

export function setPictureInPictureHint(x: number, y: number, width: number, height: number) {
  const native = callNative();
  if (!native) return;
  const rect = [x, y, width, height].map(Math.round);
  const key = rect.join(',');
  if (key === hintKey) return;
  hintKey = key;
  void native.setPictureInPictureHint(rect[0], rect[1], rect[2], rect[3]).catch(() => false);
}

export async function fullScreenIntentAllowed(): Promise<boolean> {
  const native = callNative();
  if (!native) return true;
  return native.canUseFullScreenIntent().catch(() => true);
}

export function openFullScreenIntentSettings(): Promise<boolean> {
  return callNative()?.openFullScreenIntentSettings().catch(() => false) ?? Promise.resolve(false);
}

export function setLocked(locked: boolean) {
  void callNative()?.setLocked(locked);
}

let screenSurface = false;

function sendCallSurface(visible: boolean) {
  void callNative()?.setCallSurface(visible).catch(() => undefined);
}

export function setCallSurface(visible: boolean) {
  screenSurface = visible;
  sendCallSurface(visible);
}

function stopRinging() {
  Vibration.cancel();
  void callNative()?.cancelRing(state.channelId);
  if (state.ringing) publish({ ringing: false });
}

async function lookForInvitations(channelId: number | null, options: { account?: Account | null; ring?: boolean } = {}): Promise<Invitation[]> {
  const account = 'account' in options ? options.account ?? null : activeAccount();
  const api = clientFor(account);
  if (!api || !account) return [];
  if (state.phase !== 'idle' && state.phase !== 'ended' && state.phase !== 'incoming') return [];
  try {
    const store = await api.invitations(channelId, channelId ? [] : invitedChannels());
    notePhotos(account.id, store);
    const found = invitationsFrom(store, account.partnerId);
    if (!found.length) {
      if (state.phase === 'incoming') reset();
      return [];
    }
    if (state.phase === 'incoming' && found[0].channelId === state.channelId) {
      publish({ callId: found[0].callId, callerName: found[0].callerName, callerPartnerId: found[0].callerPartnerId ?? state.callerPartnerId, video: found[0].video });
      return found;
    }
    if (state.phase === 'idle' || state.phase === 'ended') {
      ring(found[0], account);
      if (options.ring !== false) inAppRing();
    }
    return found;
  } catch {
    return [];
  }
}

function ring(invitation: Invitation, account: Account) {
  generation += 1;
  callAccount = account;
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
  Vibration.cancel();
  Vibration.vibrate([0, 900, 900], true);
  const native = callNative();
  if (!native) return;
  void native.ringing().then((ringing) => {
    if (ringing) return;
    const account = callAccount ?? activeAccount();
    void native.ring(state.callerName || state.channelName, i18n.t('call:incoming.voice'), state.channelId, state.callId, state.video, account?.db ?? '', account?.userId ?? 0);
  });
}

export function onNotification(type: string, payload: unknown) {
  if (joined && absorbPeople(payload)) collectPeople();
  for (const channelId of invitationChannels(type, payload)) void lookForInvitations(channelId);
}

function fromNative(action: CallAction) {
  const carriesAccount = Boolean(action.db || action.uid);
  const target = carriesAccount ? accountFromPush(action) : null;
  if (carriesAccount && !target) return;
  if (action.type === 'decline') {
    const mine = !target || target.id === callAccount?.id;
    if (state.phase === 'incoming' && mine && (!action.channelId || action.channelId === state.channelId)) {
      void decline();
      return;
    }
    const api = clientFor(target ?? callAccount);
    void api?.decline(action.channelId ?? state.channelId).catch(() => undefined);
    return;
  }
  if (action.type === 'hangup') {
    void hangUp('left');
    return;
  }
  if (action.type === 'stopShare') {
    void setScreenShare(false);
    return;
  }
  if (action.type === 'mute') {
    void toggleMute();
    return;
  }
  if (action.type === 'camera') {
    void toggleCamera();
    return;
  }
  if (action.type === 'pip') {
    publish({ pictureInPicture: Boolean(action.active) });
    return;
  }
  if (action.type === 'cancel') {
    const mine = !target || target.id === callAccount?.id;
    if (state.phase === 'incoming' && mine && (!action.channelId || action.channelId === state.channelId)) reset();
    return;
  }
  void takeLaunch(action, target);
}

async function takeLaunch(action: CallAction, target: Account | null) {
  if (action.type !== 'incoming' && action.type !== 'answer' && action.type !== 'open') return;
  if (!action.channelId) return;
  const account = target ?? activeAccount();
  let placed = -1;
  if (account && (state.phase === 'idle' || state.phase === 'ended')) {
    ring({ channelId: action.channelId, callId: action.callId ?? 0, callerName: action.title ?? '', callerPartnerId: null, video: Boolean(action.video), channelType: '', channelName: '' }, account);
    placed = generation;
  }
  const found = await lookForInvitations(action.channelId, { account });
  if (!found.length) {
    if (placed === generation && state.phase === 'incoming') reset();
    sendCallSurface(state.phase === 'incoming' || (screenSurface && state.phase !== 'idle'));
    return;
  }
  if (action.type === 'answer' && state.phase === 'incoming') await answer();
}

export async function takePendingActions() {
  const native = callNative();
  if (!native) return;
  const pending = await native.takePending().catch(() => []);
  for (const action of pending) fromNative(action);
  const launch = await native.takeLaunchAction().catch(() => null);
  if (launch) fromNative(launch);
}

onCallAction(fromNative);

subscribeCall(syncPictureInPicture);
onPictureInPictureAllowedChange(syncPictureInPicture);

void takePendingActions();

AppState.addEventListener('change', (next) => {
  if (next !== 'active') return;
  void takePendingActions();
});

onAccountForgotten((id) => {
  if (activeAccount()?.id === id) stopAccount();
});
