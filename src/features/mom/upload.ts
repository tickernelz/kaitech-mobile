import { ApiError } from '../../api/odoo';
import { AppError } from '../../auth/errors';

export type UploadState = 'queued' | 'sending' | 'waiting' | 'signedOut' | 'failed' | 'done';

export type MeetingChoice = { id: number; name: string } | { name: string; heldOn: string };

export type Upload = {
  key: string;
  account: string;
  programme: { id: number; name: string };
  meeting: MeetingChoice;
  title: string;
  filename: string;
  mimetype: string;
  size: number;
  file: string;
  durationMs: number;
  consentNote?: string;
  note?: string;
  createdAt: number;
  recordingId?: number;
  partBytes?: number;
  parts?: number;
  sha256?: string;
  etags: Record<string, string>;
  checksums: Record<string, string>;
  state: UploadState;
  error?: string;
  retryAt?: number;
  attempts: number;
  bytesPerSecond?: number;
};

type Stored = { number: number; etag: string; size: number };
type Begun = { recording_id: number; state: string; part_bytes: number; parts: number; stored: Stored[] };
type Followed = { recording_id: number; state: string; part_bytes: number; parts: number; stored: Stored[] };

export class PartRefused extends Error {
  constructor(readonly status: number) {
    super(`part ${status}`);
    this.name = 'PartRefused';
  }
}

export type UploadDeps = {
  request<T>(upload: Upload, path: string, method: 'GET' | 'POST', body?: unknown): Promise<T>;
  exists(upload: Upload): boolean;
  read(upload: Upload, offset: number, length: number): Promise<Uint8Array<ArrayBuffer>>;
  md5(bytes: Uint8Array<ArrayBuffer>): Promise<string>;
  fingerprint(upload: Upload): Promise<string>;
  put(upload: Upload, url: string, bytes: Uint8Array<ArrayBuffer>, checksum: string): Promise<string>;
  save(upload: Upload): void;
  remove(upload: Upload): void;
  mayStart(upload: Upload, bytes: number): boolean;
};

const retryDelaysMs = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000];

export function partSize(upload: Upload, number: number): number {
  const bytes = upload.partBytes ?? 0;
  const parts = upload.parts ?? 0;
  return number < parts ? bytes : upload.size - bytes * (parts - 1);
}

export function sentBytes(upload: Upload): number {
  if (!upload.parts) return 0;
  let sent = 0;
  for (const number of Object.keys(upload.etags)) sent += partSize(upload, Number(number));
  return sent;
}

export function isPending(upload: Upload): boolean {
  return upload.state === 'queued' || upload.state === 'sending' || upload.state === 'waiting' || upload.state === 'signedOut';
}

function transient(error: unknown): boolean {
  if (error instanceof AppError) return error.code === 'network';
  if (error instanceof ApiError) return error.status >= 500 || error.status === 429;
  if (error instanceof PartRefused) return error.status >= 500 || error.status === 429 || error.status === 408;
  return false;
}

function codeOf(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  if (error instanceof PartRefused) return 'part_refused';
  if (error instanceof AppError) return error.code;
  return 'unknown';
}

function beginPayload(upload: Upload) {
  return {
    key: upload.key,
    engagement_id: upload.programme.id,
    title: upload.title,
    filename: upload.filename,
    size: upload.size,
    mimetype: upload.mimetype,
    ...('id' in upload.meeting
      ? { meeting_id: upload.meeting.id }
      : { new_meeting: { name: upload.meeting.name, held_on: upload.meeting.heldOn } }),
    ...(upload.consentNote ? { consent_note: upload.consentNote } : {}),
    ...(upload.note ? { note: upload.note } : {}),
  };
}

function settled(upload: Upload, state: string): UploadState | null {
  if (state === 'uploading') return null;
  return state === 'failed' ? 'failed' : 'done';
}

async function checksumOf(upload: Upload, number: number, deps: UploadDeps): Promise<string> {
  const known = upload.checksums[number];
  if (known) return known;
  const bytes = await deps.read(upload, (number - 1) * (upload.partBytes ?? 0), partSize(upload, number));
  return deps.md5(bytes);
}

async function send(upload: Upload, deps: UploadDeps): Promise<Upload> {
  let current = upload;
  const update = (next: Partial<Upload>) => {
    current = { ...current, ...next };
    deps.save(current);
  };
  if (!deps.exists(current)) {
    update({ state: 'failed', error: 'file_missing' });
    return current;
  }
  if (!current.sha256) update({ sha256: await deps.fingerprint(current) });
  const begun = await deps.request<Begun>(current, '/kaitech_mobile/mom/upload', 'POST', beginPayload(current));
  const etags = { ...current.etags };
  for (const stored of begun.stored ?? []) etags[stored.number] = stored.etag;
  update({ recordingId: begun.recording_id, partBytes: begun.part_bytes, parts: begun.parts, etags });
  const ended = settled(current, begun.state);
  if (ended) {
    update({ state: ended, error: ended === 'failed' ? 'upload_failed' : undefined });
    return current;
  }
  for (let number = 1; number <= (current.parts ?? 0); number++) {
    if (current.etags[number]) continue;
    if (!deps.mayStart(current, partSize(current, number))) {
      update({ state: 'queued' });
      return current;
    }
    const bytes = await deps.read(current, (number - 1) * (current.partBytes ?? 0), partSize(current, number));
    const checksum = await deps.md5(bytes);
    const signed = await deps.request<{ parts: { number: number; url: string }[] }>(
      current,
      `/kaitech_mobile/mom/upload/${current.recordingId}/sign`,
      'POST',
      { parts: [{ number, checksum }] },
    );
    const url = signed.parts.find((part) => part.number === number)?.url;
    if (!url) throw new ApiError('parts_invalid', 400);
    const started = Date.now();
    const etag = await deps.put(current, url, bytes, checksum);
    const elapsed = Math.max(1, Date.now() - started);
    update({
      etags: { ...current.etags, [number]: etag },
      checksums: { ...current.checksums, [number]: checksum },
      bytesPerSecond: Math.round((bytes.length * 1000) / elapsed),
    });
  }
  const parts = [];
  for (let number = 1; number <= (current.parts ?? 0); number++) {
    parts.push({ number, etag: current.etags[number], checksum: await checksumOf(current, number, deps) });
  }
  const finished = await deps.request<{ recording_id: number; state: string }>(
    current,
    `/kaitech_mobile/mom/upload/${current.recordingId}/finish`,
    'POST',
    { parts, sha256: current.sha256 },
  );
  update({ state: settled(current, finished.state) ?? 'done', error: undefined });
  return current;
}

async function afterClosed(upload: Upload, deps: UploadDeps): Promise<Upload> {
  if (!upload.recordingId) return { ...upload, state: 'failed', error: 'upload_not_open' };
  const followed = await deps.request<Followed>(upload, `/kaitech_mobile/mom/upload/${upload.recordingId}`, 'GET');
  const ended = settled(upload, followed.state);
  if (ended === 'done') return { ...upload, state: 'done', error: undefined };
  return { ...upload, state: 'failed', error: 'upload_not_open' };
}

export async function advance(upload: Upload, deps: UploadDeps, now = Date.now()): Promise<Upload> {
  let current: Upload = { ...upload, state: 'sending', retryAt: undefined };
  deps.save(current);
  try {
    current = await send(current, { ...deps, save: (next) => deps.save((current = next)) });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      current = { ...current, state: 'signedOut', error: 'token_invalid' };
    } else if (error instanceof ApiError && error.code === 'upload_not_open') {
      try {
        current = await afterClosed(current, deps);
      } catch (followError) {
        current = transient(followError) ? waiting(current, followError, now) : { ...current, state: 'failed', error: codeOf(followError) };
      }
    } else if (transient(error)) {
      current = waiting(current, error, now);
    } else {
      current = { ...current, state: 'failed', error: codeOf(error) };
    }
    deps.save(current);
  }
  if (current.state === 'done') deps.remove(current);
  return current;
}

function waiting(upload: Upload, error: unknown, now: number): Upload {
  const attempts = upload.attempts + 1;
  const delay = retryDelaysMs[Math.min(attempts - 1, retryDelaysMs.length - 1)];
  return { ...upload, state: 'waiting', error: codeOf(error), attempts, retryAt: now + delay };
}
