import { ApiError } from '../src/api/odoo';
import { AppError } from '../src/auth/errors';
import { secondsOf } from '../src/features/mom/api';
import { Sha256 } from '../src/features/mom/sha256';
import { advance, PartRefused, sentBytes, type Upload, type UploadDeps } from '../src/features/mom/upload';

jest.mock('../src/auth/session', () => ({ onAccountForgotten: jest.fn(), markExpired: jest.fn(), tokenFor: jest.fn() }));
jest.mock('../src/i18n', () => ({ __esModule: true, default: { language: 'en' } }));

const text = (value: string) => new TextEncoder().encode(value);

describe('Sha256', () => {
  it('matches the standard digests', () => {
    expect(new Sha256().hex()).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(new Sha256().update(text('abc')).hex()).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(new Sha256().update(text('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).hex()).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('gives the same digest whatever the chunk sizes', () => {
    const million = new Uint8Array(1_000_000).fill(0x61);
    const chunked = new Sha256();
    for (let offset = 0, step = 1; offset < million.length; offset += step, step = (step * 7) % 997 || 1) {
      chunked.update(million.subarray(offset, offset + step));
    }
    expect(chunked.hex()).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0');
  });
});

describe('secondsOf', () => {
  it('reads item clocks and refuses anything else', () => {
    expect(secondsOf('1:14')).toBe(74);
    expect(secondsOf('1:02:03')).toBe(3723);
    expect(secondsOf('')).toBeNull();
    expect(secondsOf('Belum ditetapkan')).toBeNull();
  });
});

const partBytes = 4;
const file = text('0123456789');

function fresh(): Upload {
  return {
    key: 'k-0000000000000001',
    account: 'u1_x',
    programme: { id: 7, name: 'HKR' },
    meeting: { name: 'Kickoff', heldOn: '2026-11-21 09:00:00' },
    title: 'Kickoff',
    filename: 'kickoff.m4a',
    mimetype: 'audio/mp4',
    size: file.length,
    file: 'Audio/k.m4a',
    durationMs: 1000,
    consentNote: 'agreed',
    createdAt: 0,
    etags: {},
    checksums: {},
    state: 'queued',
    attempts: 0,
  };
}

type Call = { path: string; method: string; body?: any };

function server(options: { stored?: number[]; finish?: () => unknown; begin?: () => unknown } = {}) {
  const calls: Call[] = [];
  const puts: number[] = [];
  const reads: [number, number][] = [];
  const saved: Upload[] = [];
  const removed: string[] = [];
  let failPut: ((number: number) => Error | null) | null = null;
  const deps: UploadDeps = {
    request: async <T>(_upload: Upload, path: string, method: 'GET' | 'POST', body?: unknown) => {
      calls.push({ path, method, body });
      if (path.endsWith('/mom/upload')) {
        if (options.begin) return options.begin() as T;
        return { recording_id: 51, state: 'uploading', part_bytes: partBytes, parts: 3, stored: (options.stored ?? []).map((number) => ({ number, etag: `"s${number}"`, size: partBytes })), replayed: false } as T;
      }
      if (path.endsWith('/sign')) {
        const number = (body as { parts: { number: number }[] }).parts[0].number;
        return { parts: [{ number, url: `https://storage.test/part/${number}` }] } as T;
      }
      if (path.endsWith('/finish')) return (options.finish ? options.finish() : { recording_id: 51, state: 'uploaded' }) as T;
      return { recording_id: 51, state: 'uploaded', stored: [] } as T;
    },
    exists: () => true,
    read: async (_upload, offset, length) => {
      reads.push([offset, length]);
      return file.slice(offset, offset + length) as Uint8Array<ArrayBuffer>;
    },
    md5: async (bytes) => `md5:${new TextDecoder().decode(bytes)}`,
    fingerprint: async () => 'f'.repeat(64),
    put: async (url) => {
      const number = Number(url.split('/').pop());
      const failure = failPut?.(number);
      if (failure) throw failure;
      puts.push(number);
      return `"e${number}"`;
    },
    save: (upload) => saved.push(upload),
    remove: (upload) => removed.push(upload.file),
    stopped: () => false,
  };
  return { deps, calls, puts, reads, saved, removed, failWith: (fn: typeof failPut) => (failPut = fn) };
}

describe('advance', () => {
  it('sends every part with its checksum, closes with the fingerprint and deletes the local file', async () => {
    const { deps, calls, puts, removed } = server();
    const done = await advance(fresh(), deps);
    expect(done.state).toBe('done');
    expect(puts).toEqual([1, 2, 3]);
    expect(calls[0].body).toMatchObject({ key: 'k-0000000000000001', engagement_id: 7, new_meeting: { name: 'Kickoff', held_on: '2026-11-21 09:00:00' }, consent_note: 'agreed', size: 10 });
    const finish = calls.find((call) => call.path.endsWith('/finish'));
    expect(finish?.body).toEqual({
      sha256: 'f'.repeat(64),
      parts: [
        { number: 1, etag: '"e1"', checksum: 'md5:0123' },
        { number: 2, etag: '"e2"', checksum: 'md5:4567' },
        { number: 3, etag: '"e3"', checksum: 'md5:89' },
      ],
    });
    expect(removed).toEqual(['Audio/k.m4a']);
  });

  it('keeps the parts already sent when the signal drops and sends only the rest later', async () => {
    const first = server();
    first.failWith((number) => (number === 2 ? new PartRefused(408) : null));
    const paused = await advance(fresh(), first.deps, 1_000);
    expect(paused.state).toBe('waiting');
    expect(paused.retryAt).toBe(6_000);
    expect(paused.etags).toEqual({ 1: '"e1"' });
    expect(sentBytes(paused)).toBe(4);
    expect(first.removed).toEqual([]);

    const second = server({ stored: [1] });
    const done = await advance(paused, second.deps);
    expect(done.state).toBe('done');
    expect(second.puts).toEqual([2, 3]);
    expect(second.calls[0].body.key).toBe('k-0000000000000001');
  });

  it('asks storage what it holds after the app lost its own record and recomputes those checksums', async () => {
    const { deps, puts, reads, calls } = server({ stored: [1, 2] });
    const done = await advance(fresh(), deps);
    expect(done.state).toBe('done');
    expect(puts).toEqual([3]);
    expect(reads).toEqual([
      [8, 2],
      [0, 4],
      [4, 4],
    ]);
    expect(calls.find((call) => call.path.endsWith('/finish'))?.body.parts[0]).toEqual({ number: 1, etag: '"s1"', checksum: 'md5:0123' });
  });

  it('waits when the server or network is unreachable', async () => {
    const { deps } = server({ begin: () => { throw new AppError('network'); } });
    const waiting = await advance(fresh(), deps, 0);
    expect(waiting).toMatchObject({ state: 'waiting', error: 'network', attempts: 1 });
  });

  it('stops for a signed-out account without losing the file', async () => {
    const { deps, removed } = server({ begin: () => { throw new ApiError('token_invalid', 401); } });
    expect((await advance(fresh(), deps)).state).toBe('signedOut');
    expect(removed).toEqual([]);
  });

  it('treats an upload closed by an earlier finish as done', async () => {
    const { deps } = server({ finish: () => { throw new ApiError('upload_not_open', 409); } });
    expect((await advance(fresh(), deps)).state).toBe('done');
  });

  it('stops with the server code when the programme already holds the file', async () => {
    const { deps, removed } = server({ finish: () => { throw new ApiError('recording_duplicate', 409); } });
    const failed = await advance(fresh(), deps);
    expect(failed).toMatchObject({ state: 'failed', error: 'recording_duplicate' });
    expect(removed).toEqual([]);
  });
});
