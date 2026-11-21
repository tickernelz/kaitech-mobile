import { UploadType } from 'expo-file-system';
import { bearer, route, sessionCookie, ApiError } from '../../api/odoo';
import { AppError } from '../../auth/errors';
import type { Account } from '../../auth/oauth';
import { markExpired, tokenFor } from '../../auth/session';
import { localFile } from './files';
import { SendError, type Posted, type Uploaded } from './outbox';
import { pushFormat } from './pushAccount';
import type { PendingFile } from './types';

const uploadTimeoutMs = 120000;

function voiceSeconds(durationMs: number | null): { duration?: string } {
  if (!durationMs || durationMs <= 0) return {};
  return { duration: String(Math.min(86400, Math.max(1, Math.round(durationMs / 1000)))) };
}

export function errorCode(error: unknown): string {
  if (error instanceof ApiError) return error.code;
  if (error instanceof AppError) return error.code;
  return 'unknown';
}

export function sendErrorFrom(error: unknown): SendError {
  if (error instanceof AppError) return new SendError(error.code, error.code === 'network' || error.code === 'sessionEnded');
  if (error instanceof ApiError) return new SendError(error.code, error.status >= 500 || error.status === 429 || error.code === 'server');
  return new SendError('network', true);
}

export class ChatClient {
  constructor(readonly account: Account) {}

  get origin(): string {
    return this.account.origin;
  }

  cookie(renew = false): Promise<string> {
    return sessionCookie(this.account, renew);
  }

  async cookieHeaders(): Promise<Record<string, string>> {
    return { Cookie: await this.cookie() };
  }

  conversations(cursor: string | null, limit = 30) {
    return bearer<Record<string, unknown>>(this.account, '/kaitech_mobile/chat/conversations', { query: { limit, ...(cursor ? { cursor } : {}) } });
  }

  mentions(channelId: number, q: string) {
    return bearer<Record<string, unknown>>(this.account, '/kaitech_mobile/chat/mentions', { query: { channel_id: channelId, q: q.slice(0, 64), limit: 8 } });
  }

  messages(channelId: number, fetchParams: { before?: number; after?: number; around?: number; limit?: number }) {
    return route<Record<string, unknown>>(this.account, '/discuss/channel/messages', { channel_id: channelId, fetch_params: { limit: 30, ...fetchParams } });
  }

  channel(channelId: number) {
    return route<Record<string, unknown>>(this.account, '/mail/data', { fetch_params: [['discuss.channel', [channelId]]] });
  }

  markAsRead(channelId: number, lastMessageId: number) {
    return route(this.account, '/discuss/channel/mark_as_read', { channel_id: channelId, last_message_id: lastMessageId });
  }

  typing(channelId: number, isTyping: boolean) {
    return route(this.account, '/discuss/channel/notify_typing', { channel_id: channelId, is_typing: isTyping });
  }

  react(messageId: number, content: string, add: boolean) {
    return route<Record<string, unknown>>(this.account, '/mail/message/reaction', { action: add ? 'add' : 'remove', content, message_id: messageId });
  }

  subChannels(channelId: number) {
    return route<Record<string, unknown>>(this.account, '/discuss/channel/sub_channel/fetch', { parent_channel_id: channelId, limit: 30 });
  }

  openSubChannel(channelId: number, messageId: number) {
    return route<Record<string, unknown>>(this.account, '/discuss/channel/sub_channel/create', { parent_channel_id: channelId, from_message_id: messageId });
  }

  async post(input: { key: string; channelId: number; body: string; parentId: number | null; partnerIds: number[]; mentionTokens: Record<string, string>; files: Uploaded[] }): Promise<Posted> {
    const result = await route<Record<string, unknown> | null>(this.account, '/mail/message/post', {
      thread_model: 'discuss.channel',
      thread_id: input.channelId,
      kaitech_chat_send_key: input.key,
      context: { temporary_id: input.key },
      post_data: {
        body: input.body,
        message_type: 'comment',
        subtype_xmlid: 'mail.mt_comment',
        attachment_ids: input.files.map((file) => file.attachmentId),
        attachment_tokens: input.files.map((file) => file.ownershipToken),
        partner_ids: input.partnerIds,
        partner_ids_mention_token: input.mentionTokens,
        ...(input.parentId ? { parent_id: input.parentId } : {}),
      },
    });
    const messageId = result?.message_id;
    if (typeof messageId !== 'number') throw new ApiError('server', 500);
    return { messageId, data: result?.store_data ?? null };
  }

  async upload(channelId: number, file: PendingFile): Promise<Uploaded> {
    const token = await tokenFor(this.account.id);
    if (!token) {
      markExpired(this.account.id);
      throw new AppError('sessionEnded');
    }
    const source = localFile(file.uri);
    if (!source.exists) throw new ApiError('file_missing', 400);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), uploadTimeoutMs);
    let answer: { status: number; body: string };
    try {
      answer = await source.upload(`${this.origin}/kaitech_mobile/chat/upload`, {
        httpMethod: 'POST',
        uploadType: UploadType.MULTIPART,
        fieldName: 'file',
        mimeType: file.mimetype,
        parameters: { channel_id: String(channelId), key: file.key, ...(file.voice ? { voice: 'true', ...voiceSeconds(file.durationMs) } : {}) },
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(this.account.db ? { 'X-Odoo-Database': this.account.db } : {}) },
        signal: controller.signal,
      });
    } catch {
      throw new AppError('network');
    } finally {
      clearTimeout(timer);
    }
    let body: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(answer.body);
      if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
    } catch {
      body = null;
    }
    if (answer.status === 401) {
      markExpired(this.account.id);
      throw new AppError('sessionEnded');
    }
    if (answer.status !== 200 || typeof body?.attachment_id !== 'number' || typeof body.ownership_token !== 'string') {
      throw new ApiError(typeof body?.error_code === 'string' ? body.error_code : answer.status >= 500 ? 'server' : 'unknown', answer.status);
    }
    return { attachmentId: body.attachment_id, ownershipToken: body.ownership_token };
  }

  registerPush(fcm: string, locale: string, preview: boolean) {
    return bearer<Record<string, unknown>>(this.account, '/kaitech_mobile/push', { method: 'POST', body: { fcm, locale, preview, format: pushFormat } });
  }

  mute(channelId: number, minutes: number) {
    return bearer<Record<string, unknown>>(this.account, '/kaitech_mobile/chat/mute', { method: 'POST', body: { channel_id: channelId, minutes } });
  }

  setPushPreview(preview: boolean) {
    return bearer<Record<string, unknown>>(this.account, '/kaitech_mobile/push', { method: 'POST', body: { preview } });
  }

  websocketUrl(): string {
    return `${this.origin.replace(/^https:/, 'wss:')}/websocket`;
  }
}
