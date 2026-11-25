import { onAccountForgotten } from '../../../auth/session';
import { fetchFile } from './download';
import { mediaKind } from './kind';
import { cacheFile, cachedMeta, discardLate, epochOf, metaReady, previewPath, rememberMeta } from './meta';
import { nativeMedia } from './native';
import { downloadUrl, serverPdfThumbnail, streamUrl } from './urls';
import type { Attachment } from '../types';

export const pdfAutoBytes = 10 * 1024 * 1024;
export const previewWidth = 480;
const parallel = 2;
const attemptsPerSession = 2;

export type PreviewContext = { accountId: string; origin: string; headers: Record<string, string> };

const queue: (() => Promise<void>)[] = [];
const asked = new Set<string>();
const failures = new Map<string, number>();
let running = 0;

function pump() {
  while (running < parallel && queue.length) {
    const job = queue.shift()!;
    running += 1;
    void job()
      .catch(() => undefined)
      .finally(() => {
        running -= 1;
        pump();
      });
  }
}

function hasPreview(accountId: string, attachment: Attachment): boolean {
  const preview = cachedMeta(accountId, attachment)?.preview;
  if (!preview) return false;
  try {
    return cacheFile(preview).exists;
  } catch {
    return false;
  }
}

export function previewWanted(attachment: Attachment, origin: string): 'video' | 'pdf' | null {
  const kind = mediaKind(attachment);
  if (kind === 'video') return 'video';
  if (kind === 'pdf' && !serverPdfThumbnail(origin, attachment) && attachment.size <= pdfAutoBytes) return 'pdf';
  return null;
}

export async function describePdf(accountId: string, attachment: Attachment, uri: string, epoch = epochOf(accountId)) {
  const media = nativeMedia();
  if (!media) return;
  const relative = previewPath(accountId, attachment, 'page-1.jpg');
  const out = await media.renderPdfPage(uri, 0, previewWidth, cacheFile(relative).uri);
  if (discardLate(accountId, epoch, relative)) return;
  rememberMeta(accountId, attachment, { pages: out.pages, width: out.width, height: out.height, preview: relative }, epoch);
}

async function describeVideo(context: PreviewContext, attachment: Attachment, epoch: number) {
  const media = nativeMedia();
  if (!media) return;
  const relative = previewPath(context.accountId, attachment, 'frame.jpg');
  const out = await media.videoFrame(streamUrl(context.origin, attachment), context.headers, previewWidth, cacheFile(relative).uri);
  if (discardLate(context.accountId, epoch, relative)) return;
  rememberMeta(context.accountId, attachment, { width: out.width, height: out.height, ...(out.durationMs > 0 ? { durationMs: out.durationMs } : {}), preview: relative }, epoch);
}

export function wantPreview(context: PreviewContext, attachment: Attachment) {
  const kind = previewWanted(attachment, context.origin);
  if (!kind || !nativeMedia()) return;
  const id = `${context.accountId}|${attachment.id}|${attachment.checksum ?? ''}`;
  if (asked.has(id)) return;
  asked.add(id);
  const epoch = epochOf(context.accountId);
  queue.push(async () => {
    await metaReady(context.accountId);
    if (epoch !== epochOf(context.accountId) || hasPreview(context.accountId, attachment)) return;
    try {
      if (kind === 'video') {
        await describeVideo(context, attachment, epoch);
        return;
      }
      const file = await fetchFile(
        { accountId: context.accountId, attachmentId: attachment.id, checksum: attachment.checksum },
        downloadUrl(context.origin, attachment),
        attachment.name || `file-${attachment.id}.pdf`,
        context.headers,
      );
      await describePdf(context.accountId, attachment, file.uri, epoch);
    } catch (error) {
      const failed = (failures.get(id) ?? 0) + 1;
      failures.set(id, failed);
      if (failed < attemptsPerSession && epoch === epochOf(context.accountId)) asked.delete(id);
      throw error;
    }
  });
  pump();
}

export function forgetPreviews(accountId: string) {
  const prefix = `${accountId}|`;
  for (const id of [...asked]) if (id.startsWith(prefix)) asked.delete(id);
  for (const id of [...failures.keys()]) if (id.startsWith(prefix)) failures.delete(id);
}

onAccountForgotten(forgetPreviews);
