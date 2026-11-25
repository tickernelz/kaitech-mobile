import { cancelFile, DownloadCancelled, fetchFile, fileStatus, forgetFiles, type FileKey } from '../src/features/chat/media/download';
import { clock, extensionOf, fileFamily, mediaKind, tileSize } from '../src/features/chat/media/kind';
import { cachedMeta, forgetMeta, rememberMeta, resolveMeta } from '../src/features/chat/media/meta';
import { forgetPreviews, pdfAutoBytes, previewWanted, wantPreview } from '../src/features/chat/media/preview';
import { viewerFor } from '../src/features/chat/media/viewer';
import { attachmentFromStore } from '../src/features/chat/odoo';
import type { Attachment } from '../src/features/chat/types';

const mockFiles = new Map<string, string>();
const mockTasks: { url: string; target: string; options: { headers?: Record<string, string>; onProgress?: (p: { bytesWritten: number; totalBytes: number }) => void }; settle: (outcome: 'ok' | Error) => void; cancelled: boolean }[] = [];

jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts
      .map((part) => (typeof part === 'string' ? part : (part as { path: string }).path))
      .join('/')
      .replace(/^file:\/+/, '')
      .replace(/\/+/g, '/');
  class Directory {
    path: string;
    constructor(...parts: unknown[]) {
      this.path = join(parts);
    }
    get uri() {
      return `file:///${this.path}`;
    }
    get parentDirectory() {
      return new Directory(this.path.split('/').slice(0, -1).join('/'));
    }
    get exists() {
      return [...mockFiles.keys()].some((key) => key.startsWith(`${this.path}/`));
    }
    list() {
      return [...mockFiles.keys()].filter((key) => key.startsWith(`${this.path}/`));
    }
    create() {
      return undefined;
    }
    delete() {
      for (const key of [...mockFiles.keys()]) if (key.startsWith(`${this.path}/`)) mockFiles.delete(key);
    }
  }
  class File {
    path: string;
    constructor(...parts: unknown[]) {
      this.path = join(parts);
    }
    get uri() {
      return `file:///${this.path}`;
    }
    get exists() {
      return mockFiles.has(this.path);
    }
    get size() {
      return mockFiles.get(this.path)?.length ?? null;
    }
    get parentDirectory() {
      return new Directory(this.path.split('/').slice(0, -1).join('/'));
    }
    textSync() {
      return mockFiles.get(this.path) ?? '';
    }
    async text() {
      return mockFiles.get(this.path) ?? '';
    }
    writeSync(text: string) {
      mockFiles.set(this.path, text);
    }
    delete() {
      mockFiles.delete(this.path);
    }
    moveSync(target: File) {
      mockFiles.set(target.path, mockFiles.get(this.path) ?? '');
      mockFiles.delete(this.path);
    }
  }
  class DownloadTask {
    entry: (typeof mockTasks)[number];
    constructor(url: string, target: File, options: (typeof mockTasks)[number]['options']) {
      let settle: (outcome: 'ok' | Error) => void = () => undefined;
      const done = new Promise<'ok' | Error>((resolve) => (settle = resolve));
      this.entry = { url, target: target.path, options, settle, cancelled: false };
      this.result = done.then((outcome) => {
        if (outcome instanceof Error) throw outcome;
        mockFiles.set(target.path, 'downloaded-bytes');
        return target;
      });
      mockTasks.push(this.entry);
    }
    result: Promise<File>;
    downloadAsync() {
      return this.result;
    }
    cancel() {
      this.entry.cancelled = true;
      this.entry.settle(new Error('cancelled'));
    }
  }
  return { Directory, File, DownloadTask, Paths: { cache: { path: 'cache' }, document: { path: 'doc' } } };
});
jest.mock('../src/features/chat/media/native', () => ({ nativeMedia: () => mockNative }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/auth/session', () => ({ onAccountForgotten: () => () => undefined }));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));

const mockNative = {
  renderPdfPage: jest.fn(async () => ({ width: 480, height: 679, pages: 12 })),
  videoFrame: jest.fn(async () => ({ width: 480, height: 270, durationMs: 83000 })),
};


const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function attachment(id: number, name: string, mimetype: string, extra: Partial<Attachment> = {}): Attachment {
  return { id, name, mimetype, size: 2048, voice: false, accessToken: null, checksum: `c${id}`, url: null, ...extra };
}

const keyA: FileKey = { accountId: 'A', attachmentId: 7, checksum: 'c7' };
const keyB: FileKey = { accountId: 'B', attachmentId: 7, checksum: 'c7' };

beforeEach(() => {
  mockFiles.clear();
  mockTasks.length = 0;
  forgetFiles('A');
  forgetFiles('B');
  forgetPreviews('A');
  mockNative.renderPdfPage.mockClear();
  mockNative.videoFrame.mockClear();
});

describe('which preview a chat file gets', () => {
  it('shows pictures and videos as media and everything else by its kind, trusting the extension when the server type is generic', () => {
    expect(mediaKind(attachment(1, 'a.jpg', 'image/jpeg'))).toBe('image');
    expect(mediaKind(attachment(1, 'logo.svg', 'image/svg+xml'))).toBe('file');
    expect(mediaKind(attachment(1, 'clip.mov', 'video/quicktime'))).toBe('video');
    expect(mediaKind(attachment(1, 'laporan.pdf', 'application/octet-stream'))).toBe('pdf');
    expect(fileFamily('Budget.xlsx', 'application/octet-stream')).toBe('sheet');
    expect(fileFamily('Notes.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc');
    expect(fileFamily('deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation')).toBe('slides');
    expect(fileFamily('backup.zip', 'application/zip')).toBe('archive');
    expect(fileFamily('README', 'application/octet-stream')).toBe('other');
    expect(extensionOf('Lembur Gudang Q3.pptx')).toBe('PPTX');
  });

  it('keeps the true shape of a picture inside the bubble and only clamps extreme shapes', () => {
    expect(tileSize({ width: 4000, height: 3000 }, 260)).toEqual({ width: 260, height: 195 });
    expect(tileSize({ width: 1080, height: 1920 }, 260)).toEqual({ width: 192, height: 320 });
    expect(tileSize({ width: 3000, height: 500 }, 260)).toEqual({ width: 260, height: 137 });
    expect(tileSize({}, 260)).toEqual({ width: 260, height: 195 });
  });

  it('writes video length like a player clock', () => {
    expect(clock(83000)).toBe('1:23');
    expect(clock(3723000)).toBe('1:02:03');
    expect(clock(400)).toBe('0:00');
  });
});

describe('media details sent by the server', () => {
  it('reads the size, page count and thumbnail of each attachment, and leaves media out when the server sends none', () => {
    const [plain, video, pdf] = attachmentFromStore({
      'ir.attachment': [
        { id: 1, name: 'a.jpg', mimetype: 'image/jpeg', file_size: 10 },
        { id: 2, name: 'b.jpg', mimetype: 'image/jpeg', kaitech_mobile_width: 1920, kaitech_mobile_height: 1080, kaitech_mobile_pages: 0 },
        { id: 3, name: 'c.pdf', mimetype: 'application/pdf', kaitech_mobile_pages: 4, has_thumbnail: true, thumbnail_access_token: 'tok' },
      ],
    }).sort((a, b) => a.id - b.id);
    expect(plain.media).toBeUndefined();
    expect(video.media).toEqual({ width: 1920, height: 1080 });
    expect(pdf.media).toEqual({ pages: 4, thumbnail: { token: 'tok' } });
  });
});

describe('downloading a chat file', () => {
  it('reports progress, then keeps the file so a second tap opens it without downloading again', async () => {
    const promise = fetchFile(keyA, 'https://lab0/web/content/7', 'deck.pptx', { Cookie: 'session_id=a' });
    expect(fileStatus(keyA, 'deck.pptx')).toEqual({ state: 'downloading', received: 0, total: 0 });
    expect(mockTasks[0].options.headers).toEqual({ Cookie: 'session_id=a' });
    mockTasks[0].options.onProgress?.({ bytesWritten: 500, totalBytes: 1000 });
    expect(fileStatus(keyA, 'deck.pptx')).toEqual({ state: 'downloading', received: 500, total: 1000 });
    mockTasks[0].settle('ok');
    const file = await promise;
    expect(file.uri).toBe('file:///cache/chat-opened/A/7-c7/deck.pptx');
    expect(fileStatus(keyA, 'deck.pptx')).toEqual({ state: 'done' });
    await fetchFile(keyA, 'https://lab0/web/content/7', 'deck.pptx', {});
    expect(mockTasks).toHaveLength(1);
  });

  it('joins a tap that arrives while the same file is downloading', () => {
    const first = fetchFile(keyA, 'u', 'a.zip', {});
    const second = fetchFile(keyA, 'u', 'a.zip', {});
    expect(second).toBe(first);
    expect(mockTasks).toHaveLength(1);
    first.catch(() => undefined);
  });

  it('marks a failed download, as when the phone is offline, and downloads again on retry', async () => {
    const failing = fetchFile(keyA, 'u', 'a.zip', {});
    mockTasks[0].settle(new Error('The Internet connection appears to be offline.'));
    await expect(failing).rejects.toThrow('offline');
    expect(fileStatus(keyA, 'a.zip')).toEqual({ state: 'failed' });
    const retry = fetchFile(keyA, 'u', 'a.zip', {});
    expect(mockTasks).toHaveLength(2);
    mockTasks[1].settle('ok');
    await retry;
    expect(fileStatus(keyA, 'a.zip')).toEqual({ state: 'done' });
  });

  it('goes back to not downloaded when the person cancels, leaving no partial file', async () => {
    const promise = fetchFile(keyA, 'u', 'big.mp4', {});
    cancelFile(keyA, 'big.mp4');
    await expect(promise).rejects.toBeInstanceOf(DownloadCancelled);
    expect(fileStatus(keyA, 'big.mp4')).toEqual({ state: 'idle' });
    expect([...mockFiles.keys()].filter((path) => path.endsWith('.part'))).toEqual([]);
  });

  it('keeps each account to its own copy and forgets only the account that signed out', async () => {
    const a = fetchFile(keyA, 'u', 'same.pdf', {});
    mockTasks[0].settle('ok');
    await a;
    const b = fetchFile(keyB, 'u', 'same.pdf', {});
    expect(mockTasks).toHaveLength(2);
    expect(mockTasks[1].target).toContain('chat-opened/B/');
    forgetFiles('A');
    expect(mockTasks[1].cancelled).toBe(false);
    expect(fileStatus(keyA, 'same.pdf')).toEqual({ state: 'idle' });
    expect([...mockFiles.keys()].some((path) => path.startsWith('cache/chat-opened/A/'))).toBe(false);
    mockTasks[1].settle('ok');
    await b;
    expect(fileStatus(keyB, 'same.pdf')).toEqual({ state: 'done' });
  });
});

describe('remembered media details', () => {
  it('prefers what the server says and fills the rest from what this phone measured', () => {
    const shown = attachment(5, 'p.jpg', 'image/jpeg', { media: { width: 1000, height: 750 } });
    rememberMeta('A', shown, { width: 640, height: 360, durationMs: 999, preview: 'A/5-c5/.preview/frame.jpg' });
    expect(resolveMeta(shown, cachedMeta('A', shown))).toEqual({ width: 1000, height: 750, durationMs: 999, pages: undefined, preview: 'A/5-c5/.preview/frame.jpg' });
    expect(cachedMeta('B', shown)).toBeUndefined();
  });

  it('drops a measurement that lands after its account signed out', () => {
    const shown = attachment(6, 'p.jpg', 'image/jpeg');
    const epoch = 0;
    forgetMeta('A');
    rememberMeta('A', shown, { width: 10, height: 10 }, epoch);
    expect(cachedMeta('A', shown)).toBeUndefined();
  });
});

describe('making previews', () => {
  const context = { accountId: 'A', origin: 'https://lab0', headers: { Cookie: 'session_id=a' } };

  it('makes a video preview once, streaming the frame with the session cookie', async () => {
    const video = attachment(8, 'clip.mp4', 'video/mp4');
    wantPreview(context, video);
    wantPreview(context, video);
    await flush();
    expect(mockNative.videoFrame).toHaveBeenCalledTimes(1);
    expect(mockNative.videoFrame.mock.calls[0]).toEqual(['https://lab0/web/content/8?filename=clip.mp4&unique=c8', { Cookie: 'session_id=a' }, 480, 'file:///cache/chat-opened/A/8-c8/.preview/frame.jpg']);
    await flush();
    expect(cachedMeta('A', video)).toMatchObject({ width: 480, height: 270, durationMs: 83000 });
  });

  it('asks again after a failed frame read, as when the network dropped, but stops after the second failure', async () => {
    const video = attachment(13, 'drop.mp4', 'video/mp4');
    mockNative.videoFrame.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
    wantPreview(context, video);
    await flush();
    wantPreview(context, video);
    await flush();
    wantPreview(context, video);
    await flush();
    expect(mockNative.videoFrame).toHaveBeenCalledTimes(2);
    expect(cachedMeta('A', video)).toBeUndefined();
  });

  it('leaves no file behind for an account forgotten while its frame was being read', async () => {
    const video = attachment(14, 'late.mp4', 'video/mp4');
    let finish: () => void = () => undefined;
    mockNative.videoFrame.mockImplementationOnce(
      (_url: string, _headers: Record<string, string>, _width: number, target: string) =>
        new Promise((resolve) => {
          finish = () => {
            mockFiles.set(target.replace(/^file:\/+/, ''), 'jpeg');
            resolve({ width: 480, height: 270, durationMs: 1000 });
          };
        }),
    );
    wantPreview(context, video);
    await flush();
    expect(mockNative.videoFrame).toHaveBeenCalledTimes(1);
    forgetFiles('A');
    finish();
    await flush();
    expect(cachedMeta('A', video)).toBeUndefined();
    expect([...mockFiles.keys()].filter((path) => path.startsWith('cache/chat-opened/A/'))).toEqual([]);
  });

  it('reads the remembered previews of an account from disk without making them again', async () => {
    const video = attachment(15, 'seen.mp4', 'video/mp4');
    forgetMeta('A');
    mockFiles.set('cache/chat-opened/A/15-c15/.preview/frame.jpg', 'jpeg');
    mockFiles.set('cache/chat-opened/A/media.json', JSON.stringify({ '15-c15': { width: 320, height: 180, durationMs: 5000, preview: 'A/15-c15/.preview/frame.jpg' } }));
    wantPreview(context, video);
    await flush();
    await flush();
    expect(mockNative.videoFrame).not.toHaveBeenCalled();
    expect(cachedMeta('A', video)).toMatchObject({ durationMs: 5000 });
  });

  it('downloads a small PDF to draw its first page and count pages, but never a large one or one the server already drew', async () => {
    const small = attachment(9, 'laporan.pdf', 'application/pdf', { size: 200_000 });
    expect(previewWanted(attachment(10, 'big.pdf', 'application/pdf', { size: pdfAutoBytes + 1 }), 'o')).toBeNull();
    expect(previewWanted(attachment(11, 'web.pdf', 'application/pdf', { media: { thumbnail: { token: null } } }), 'o')).toBeNull();
    expect(previewWanted(attachment(12, 'notes.txt', 'text/plain'), 'o')).toBeNull();
    wantPreview(context, small);
    await flush();
    mockTasks[0].settle('ok');
    await flush();
    await flush();
    expect(mockNative.renderPdfPage).toHaveBeenCalledWith('file:///cache/chat-opened/A/9-c9/laporan.pdf', 0, 480, 'file:///cache/chat-opened/A/9-c9/.preview/page-1.jpg');
    expect(cachedMeta('A', small)).toMatchObject({ pages: 12 });
  });
});

describe('swiping through the media of a conversation', () => {
  const photo = attachment(1, 'a.jpg', 'image/jpeg');
  const clip = attachment(2, 'b.mp4', 'video/mp4');
  const doc = attachment(3, 'c.pdf', 'application/pdf');
  const voice = attachment(4, 'v.m4a', 'audio/mp4', { voice: true });

  it('opens at the tapped item among every picture and video of the conversation', () => {
    expect(viewerFor('A', 'o', clip, [photo, clip], [clip])).toMatchObject({ items: [photo, clip], index: 1 });
  });

  it('falls back to the message itself, leaving out documents and voice notes', () => {
    expect(viewerFor('A', 'o', clip, [], [photo, clip, doc, voice])).toMatchObject({ items: [photo, clip], index: 1 });
    expect(viewerFor('A', 'o', photo, [], [])).toMatchObject({ items: [photo], index: 0 });
  });
});
