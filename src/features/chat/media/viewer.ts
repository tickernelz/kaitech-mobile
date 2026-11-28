import { router } from 'expo-router';
import { onAccountForgotten } from '../../../auth/session';
import { recordingIdOf } from '../../call/recordingLink';
import type { Attachment, Message } from '../types';
import { isVisual } from './kind';

export type ViewerSession = { accountId: string; origin: string; items: Attachment[]; index: number };
export type PdfSource = { url: string; headers: () => Promise<Record<string, string>> };
export type PdfSession = { accountId: string; origin: string; attachment: Attachment; source?: PdfSource };

let viewer: ViewerSession | null = null;
let pdf: PdfSession | null = null;

export function galleryItems(attachments: Attachment[]): Attachment[] {
  return attachments.filter((attachment) => !attachment.voice && recordingIdOf(attachment.url) === null && isVisual(attachment));
}

export function galleryOfMessages(messages: Message[]): Attachment[] {
  return galleryItems(messages.flatMap((message) => message.attachments));
}

export function viewerFor(accountId: string, origin: string, attachment: Attachment, gallery: Attachment[], siblings: Attachment[]): ViewerSession {
  const items = gallery.some((item) => item.id === attachment.id) ? gallery : galleryItems(siblings);
  const listed = items.some((item) => item.id === attachment.id) ? items : [attachment];
  return { accountId, origin, items: listed, index: listed.findIndex((item) => item.id === attachment.id) };
}

export function openViewer(session: ViewerSession) {
  viewer = session;
  router.push('/media');
}

export function viewerSession(): ViewerSession | null {
  return viewer;
}

export function openPdf(session: PdfSession) {
  pdf = session;
  router.push('/pdf');
}

export function pdfSession(): PdfSession | null {
  return pdf;
}

export function forgetViewer(accountId: string) {
  if (viewer?.accountId === accountId) viewer = null;
  if (pdf?.accountId === accountId) pdf = null;
}

onAccountForgotten(forgetViewer);
