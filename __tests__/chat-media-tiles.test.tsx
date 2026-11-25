import { fireEvent, render, screen } from '@testing-library/react-native';
import { createElement } from 'react';
import type { Attachment } from '../src/features/chat/types';
import type { FileStatus } from '../src/features/chat/media/download';

const mockStatus = new Map<number, FileStatus>();
const mockFetch = jest.fn(async () => ({ uri: 'file:///cache/x' }));
const mockCancel = jest.fn();
const mockPush = jest.fn();
const mockPreview = jest.fn();
const mockMeasured = new Map<number, { width?: number; height?: number; durationMs?: number }>();

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('../src/features/chat/media/native', () => ({ nativeMedia: () => ({}) }));
jest.mock('../src/features/chat/chat', () => ({
  useChat: (select: (state: { accountId: string }) => unknown) => select({ accountId: 'A' }),
  chatClient: () => ({ account: { id: 'A' }, origin: 'https://lab0', cookieHeaders: async () => ({ Cookie: 'session_id=a' }) }),
}));
jest.mock('../src/features/chat/ui/useCookie', () => ({ useCookie: () => ({ Cookie: 'session_id=a' }) }));
jest.mock('../src/features/chat/media/preview', () => ({ wantPreview: (...args: unknown[]) => mockPreview(...args) }));
jest.mock('../src/features/chat/media/meta', () => {
  const actual = jest.requireActual('../src/features/chat/media/meta');
  return { ...actual, useMediaMeta: (_: string, attachment: Attachment) => actual.resolveMeta(attachment, mockMeasured.get(attachment.id)), rememberMeta: jest.fn() };
});
jest.mock('../src/features/chat/media/download', () => ({
  ...jest.requireActual('../src/features/chat/media/download'),
  useFileStatus: (key: { attachmentId: number } | null) => (key && mockStatus.get(key.attachmentId)) ?? { state: 'idle' },
  fetchFile: (...args: unknown[]) => mockFetch(...(args as [])),
  cancelFile: (...args: unknown[]) => mockCancel(...args),
}));

require('../src/i18n');
const { MediaAttachment } = require('../src/features/chat/ui/media/Tiles') as typeof import('../src/features/chat/ui/media/Tiles');
const { GalleryContext } = require('../src/features/chat/ui/media/gallery') as typeof import('../src/features/chat/ui/media/gallery');
const { viewerSession, pdfSession } = require('../src/features/chat/media/viewer') as typeof import('../src/features/chat/media/viewer');

function attachment(id: number, name: string, mimetype: string, extra: Partial<Attachment> = {}): Attachment {
  return { id, name, mimetype, size: 2048, voice: false, accessToken: null, checksum: `c${id}`, url: null, ...extra };
}

function show(item: Attachment, gallery: Attachment[] = []) {
  return render(
    createElement(GalleryContext.Provider, { value: () => gallery }, createElement(MediaAttachment, { attachment: item, origin: 'https://lab0', mine: false, siblings: [item], width: 260 })),
  );
}

beforeEach(() => {
  mockStatus.clear();
  mockFetch.mockClear();
  mockCancel.mockClear();
  mockPush.mockClear();
  mockPreview.mockClear();
});

describe('a photo in the chat', () => {
  it('takes its true shape from the server before loading and opens the viewer among the conversation media', async () => {
    const before = attachment(1, 'a.jpg', 'image/jpeg');
    const photo = attachment(2, 'portrait.jpg', 'image/jpeg', { media: { width: 1080, height: 1920 } });
    await show(photo, [before, photo]);
    expect(screen.getByTestId('media-photo')).toHaveStyle({ width: 192, height: 320 });
    await fireEvent.press(screen.getByTestId('media-photo'));
    expect(mockPush).toHaveBeenCalledWith('/media');
    expect(viewerSession()).toMatchObject({ accountId: 'A', index: 1, items: [before, photo] });
  });

  it('asks to try again when the picture cannot load, as offline, instead of opening an empty viewer', async () => {
    await show(attachment(3, 'a.jpg', 'image/jpeg'));
    await fireEvent(screen.getByTestId('media-photo-image'), 'error');
    expect(screen.getByTestId('media-photo-failed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('media-photo'));
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByTestId('media-photo-failed')).toBeNull();
  });
});

describe('a video in the chat', () => {
  it('shows its length with a play button, asks for a preview frame, and plays in the viewer on tap', async () => {
    const clip = attachment(4, 'clip.mp4', 'video/mp4');
    mockMeasured.set(4, { width: 1920, height: 1080, durationMs: 61000 });
    await show(clip, [clip]);
    expect(screen.getByTestId('video-duration')).toHaveTextContent('1:01');
    expect(mockPreview).toHaveBeenCalledWith({ accountId: 'A', origin: 'https://lab0', headers: { Cookie: 'session_id=a' } }, clip);
    await fireEvent.press(screen.getByTestId('media-video'));
    expect(viewerSession()).toMatchObject({ items: [clip], index: 0 });
  });
});

describe('a PDF in the chat', () => {
  it('shows the first page the server drew, the page count, and opens the in-app reader', async () => {
    const pdf = attachment(5, 'Laporan.pdf', 'application/pdf', { media: { pages: 4, thumbnail: { token: 'tok' } } });
    await show(pdf);
    expect(screen.getByText(/4 pages/)).toBeTruthy();
    expect(screen.getByTestId('pdf-preview').props.source.uri).toBe('https://lab0/web/image/ir.attachment/5/thumbnail?access_token=tok&unique=c5');
    await fireEvent.press(screen.getByTestId('media-pdf'));
    expect(mockPush).toHaveBeenCalledWith('/pdf');
    expect(pdfSession()).toMatchObject({ accountId: 'A', attachment: pdf });
  });
});

describe('any other file in the chat', () => {
  const deck = attachment(6, 'Lembur Gudang Q3.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', { size: 600 * 1024 * 1024 });

  it('waits for a tap before downloading, even a large file, and shows its kind and size', async () => {
    await show(deck);
    expect(screen.getByText(/PPTX · 600 MB/)).toBeTruthy();
    expect(screen.getByTestId('icon-slides', { includeHiddenElements: true })).toBeTruthy();
    expect(mockFetch).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('file-download'));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('shows progress and lets the person cancel while it downloads', async () => {
    mockStatus.set(6, { state: 'downloading', received: 300 * 1024 * 1024, total: 600 * 1024 * 1024 });
    await show(deck);
    expect(screen.getByText(/300 MB of 600 MB/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('file-cancel'));
    expect(mockCancel).toHaveBeenCalledWith({ accountId: 'A', attachmentId: 6, checksum: 'c6' }, 'Lembur Gudang Q3.pptx');
  });

  it('says the download failed and tries again on tap', async () => {
    mockStatus.set(6, { state: 'failed' });
    await show(deck);
    expect(screen.getByTestId('file-failed')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('file-retry'));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('offers sharing once the file is on the phone', async () => {
    mockStatus.set(6, { state: 'done' });
    await show(deck);
    expect(screen.getByTestId('attachment-share')).toBeTruthy();
    expect(screen.queryByTestId('file-download')).toBeNull();
  });
});
