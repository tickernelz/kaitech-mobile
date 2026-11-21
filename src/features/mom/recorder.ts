import {
  AudioQuality,
  IOSOutputFormat,
  requestNotificationPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  type RecordingOptions,
  type RecordingStatus,
} from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';
import type { AudioRecorder } from 'expo-audio/build/AudioModule.types';
import { createRecordingOptions } from 'expo-audio/build/utils/options';
import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { setMeetingRecording } from '../../audio/meeting';
import { onAccountForgotten } from '../../auth/session';
import type { MeetingChoice } from './upload';
import { documentPath, enqueue, localFile, recordingPrefix } from './uploads';

export const bitRate = 64_000;

const options: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44_100,
  numberOfChannels: 1,
  bitRate,
  isMeteringEnabled: true,
  directory: 'document',
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.HIGH },
  web: { mimeType: 'audio/webm', bitsPerSecond: bitRate },
};

export type Marker = { id: string; atMs: number; text: string };

export type Setup = {
  account: string;
  programme: { id: number; name: string };
  meeting: MeetingChoice;
  title: string;
  consentNote?: string;
  consentAt?: number;
};

export type Phase = 'recording' | 'paused' | 'saving';

export type Recording = Setup & { key: string; startedAt: number; phase: Phase; markers: Marker[]; durationMs: number };

export type StartResult = 'started' | 'denied' | 'busy' | 'failed';

let current: Recording | null = null;
let recorder: AudioRecorder | null = null;
let subscription: { remove: () => void } | null = null;
let lastSaved: string | null = null;
const listeners = new Set<() => void>();

function set(next: Recording | null) {
  current = next;
  setMeetingRecording(next !== null);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRecording(): Recording | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function getRecording(): Recording | null {
  return current;
}

export function takeLastSaved(): string | null {
  const key = lastSaved;
  lastSaved = null;
  return key;
}

function duration(): number {
  return recorder?.getStatus().durationMillis ?? current?.durationMs ?? 0;
}

function slug(text: string): string {
  const cleaned = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return cleaned || 'rapat';
}

function stamp(at: number): string {
  const date = new Date(at);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}-${two(date.getHours())}${two(date.getMinutes())}`;
}

export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const two = (value: number) => String(value).padStart(2, '0');
  return `${two(Math.floor(total / 3600))}:${two(Math.floor(total / 60) % 60)}:${two(total % 60)}`;
}

export function markerNote(markers: Marker[]): string {
  return markers
    .map((marker) => `${clock(marker.atMs)} ${marker.text.trim()}`.trim())
    .join('\n');
}

function release() {
  subscription?.remove();
  subscription = null;
  recorder?.release();
  recorder = null;
  void setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false }).catch(() => undefined);
}

function save(uri: string | null) {
  const session = current;
  const durationMs = duration();
  release();
  if (!session) return;
  const file = uri ? new File(uri) : null;
  if (!file?.exists || !file.size) {
    set(null);
    return;
  }
  const path = documentPath(file.uri);
  enqueue({
    key: session.key,
    account: session.account,
    programme: session.programme,
    meeting: session.meeting,
    title: session.title,
    filename: `${slug(session.title)}-${stamp(session.startedAt)}.m4a`,
    mimetype: 'audio/mp4',
    size: file.size,
    file: path,
    durationMs,
    consentNote: session.consentNote,
    note: session.markers.length ? markerNote(session.markers) : undefined,
    createdAt: Date.now(),
    etags: {},
    checksums: {},
    state: 'queued',
    attempts: 0,
  });
  lastSaved = session.key;
  set(null);
}

function onStatus(status: RecordingStatus) {
  if (!status.isFinished || !current || current.phase === 'saving') return;
  set({ ...current, phase: 'saving', durationMs: duration() });
  save(status.url ?? recorder?.uri ?? null);
}

export async function start(setup: Setup): Promise<StartResult> {
  if (current) return 'busy';
  const permission = await requestRecordingPermissionsAsync();
  if (!permission.granted) return 'denied';
  if (Platform.OS === 'android') await requestNotificationPermissionsAsync().catch(() => undefined);
  try {
    await setAudioModeAsync({
      allowsRecording: true,
      allowsBackgroundRecording: true,
      playsInSilentMode: true,
      interruptionMode: 'doNotMix',
    });
    const key = Crypto.randomUUID();
    const made = new AudioModule.AudioRecorder(createRecordingOptions({ ...options, fileName: `${recordingPrefix}${key}` }));
    recorder = made;
    subscription = made.addListener('recordingStatusUpdate', onStatus);
    await made.prepareToRecordAsync();
    made.record();
    set({ ...setup, key, startedAt: Date.now(), phase: 'recording', markers: [], durationMs: 0 });
    return 'started';
  } catch (error) {
    console.error('Meeting recording could not start', error);
    release();
    set(null);
    return 'failed';
  }
}

export function pause() {
  if (!recorder || current?.phase !== 'recording') return;
  recorder.pause();
  set({ ...current, phase: 'paused', durationMs: duration() });
}

export function resume() {
  if (!recorder || current?.phase !== 'paused') return;
  recorder.record();
  set({ ...current, phase: 'recording' });
}

export function mark(): Marker | null {
  if (!current || current.phase === 'saving') return null;
  const marker = { id: Crypto.randomUUID(), atMs: duration(), text: '' };
  set({ ...current, markers: [...current.markers, marker] });
  return marker;
}

export function describeMarker(id: string, text: string) {
  if (!current) return;
  set({ ...current, markers: current.markers.map((marker) => (marker.id === id ? { ...marker, text } : marker)) });
}

export async function stop() {
  if (!recorder || !current || current.phase === 'saving') return;
  const made = recorder;
  set({ ...current, phase: 'saving', durationMs: duration() });
  try {
    await made.stop();
  } finally {
    if (recorder === made) save(made.uri);
  }
}

export async function discardRecording() {
  if (!current) return;
  const made = recorder;
  set(null);
  subscription?.remove();
  subscription = null;
  const uri = made?.uri ?? null;
  await made?.stop().catch(() => undefined);
  release();
  if (uri) {
    const file = localFile(documentPath(uri));
    if (file.exists) file.delete();
  }
}

export function useRecorderClock(active: boolean, bars = 36): { durationMs: number; levels: number[] } {
  const [reading, setReading] = useState(() => ({ durationMs: duration(), levels: [] as number[] }));
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      const status = recorder?.getStatus();
      if (!status) return;
      const level = status.isRecording && typeof status.metering === 'number' ? Math.min(1, Math.max(0.06, (status.metering + 60) / 60)) : 0.06;
      setReading((before) => ({ durationMs: status.durationMillis, levels: [...before.levels, level].slice(-bars) }));
    }, 200);
    return () => clearInterval(id);
  }, [active, bars]);
  return reading;
}

onAccountForgotten((account) => {
  if (current?.account === account) void discardRecording();
});
