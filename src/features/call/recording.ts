import type { Account } from '../../auth/oauth';
import { bearer } from '../../api/odoo';

export type RecordingState = 'recording' | 'ending' | 'done' | 'failed' | 'deleted';

export type Recording = {
  id: number;
  channelId: number;
  state: RecordingState;
  audioOnly: boolean;
  startedBy: string | null;
  startedAt: Date | null;
  endedAt: Date | null;
  duration: number | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
};

export type Playback = { recording: Recording; url: string | null };

const states: RecordingState[] = ['recording', 'ending', 'done', 'failed', 'deleted'];
const playPath = /\/kaitech_mobile\/call\/recordings\/(\d+)\/play$/;

type Raw = Record<string, unknown>;

export function odooDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

export function recordingFrom(value: unknown): Recording | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Raw;
  const state = states.find((item) => item === raw.state);
  if (typeof raw.id !== 'number' || !state) return null;
  const starter = raw.started_by && typeof raw.started_by === 'object' ? (raw.started_by as Raw) : null;
  return {
    id: raw.id,
    channelId: typeof raw.channel_id === 'number' ? raw.channel_id : 0,
    state,
    audioOnly: raw.audio_only === true,
    startedBy: typeof starter?.name === 'string' ? starter.name : null,
    startedAt: odooDate(raw.started_at),
    endedAt: odooDate(raw.ended_at),
    duration: typeof raw.duration === 'number' ? raw.duration : null,
    expiresAt: odooDate(raw.expires_at),
    deletedAt: odooDate(raw.deleted_at),
  };
}

export function recordingIdOf(url: string | null | undefined): number | null {
  const match = url ? playPath.exec(url) : null;
  return match ? Number(match[1]) : null;
}

export async function startRecording(account: Account, channelId: number): Promise<Recording | null> {
  const answer = await bearer<{ recording?: unknown }>(account, '/kaitech_mobile/call/recording/start', { method: 'POST', body: { channel_id: channelId } });
  return recordingFrom(answer?.recording);
}

export async function stopRecording(account: Account, channelId: number): Promise<Recording | null> {
  const answer = await bearer<{ recording?: unknown }>(account, '/kaitech_mobile/call/recording/stop', { method: 'POST', body: { channel_id: channelId } });
  return recordingFrom(answer?.recording);
}

export async function currentRecording(account: Account, channelId: number): Promise<Recording | null> {
  const answer = await bearer<{ recording?: unknown }>(account, '/kaitech_mobile/call/recording', { query: { channel_id: channelId } });
  return recordingFrom(answer?.recording);
}

export async function playback(account: Account, id: number): Promise<Playback | null> {
  const answer = await bearer<{ recording?: unknown; url?: unknown }>(account, `/kaitech_mobile/call/recordings/${id}`);
  const recording = recordingFrom(answer?.recording);
  if (!recording) return null;
  const url = recording.state === 'done' && typeof answer?.url === 'string' && answer.url.startsWith('https://') ? answer.url : null;
  return { recording, url };
}
