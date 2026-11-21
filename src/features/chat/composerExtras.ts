import { route, rpc } from '../../api/odoo';
import { chatClient, newKey } from './chat';
import { composeBody, mentionsInText } from './html';
import { run, odooDatetime } from './messageActions';
import type { Mention, PendingFile } from './types';

export type Canned = { id: number; source: string; substitution: string };

export function cannedResponses(query: string) {
  return run(async (account): Promise<Canned[]> => {
    const rows = await rpc<{ id: number; source: string; substitution: string }[]>(account, 'mail.canned.response', 'search_read', [query ? [['source', 'ilike', query]] : []], {
      fields: ['source', 'substitution'],
      limit: 8,
      order: 'last_used desc, id desc',
    });
    return (rows ?? []).map((row) => ({ id: row.id, source: row.source ?? '', substitution: row.substitution ?? '' }));
  });
}

export function markCannedUsed(id: number) {
  return run(async (account) => {
    await rpc(account, 'mail.canned.response', 'write', [[id], { last_used: odooDatetime(Date.now()) }]);
  });
}

export type Gif = { id: string; url: string; width: number; height: number };

export function searchGifs(term: string, locale: string, position: string | null) {
  return run(async (account): Promise<{ gifs: Gif[]; next: string | null }> => {
    const raw = await route<{ results?: unknown[]; next?: unknown }>(account, '/discuss/gif/search', { search_term: term, locale, country: locale === 'id' ? 'ID' : 'US', ...(position ? { position } : {}) });
    const gifs: Gif[] = [];
    for (const item of raw?.results ?? []) {
      const record = item as { id?: unknown; media_formats?: { tinygif?: { url?: unknown; dims?: unknown } } };
      const tiny = record.media_formats?.tinygif;
      const dims = Array.isArray(tiny?.dims) ? tiny.dims : [];
      if (typeof tiny?.url === 'string') gifs.push({ id: String(record.id ?? tiny.url), url: tiny.url, width: Number(dims[0]) || 1, height: Number(dims[1]) || 1 });
    }
    return { gifs, next: typeof raw?.next === 'string' && raw.next ? raw.next : null };
  });
}

export function gifBody(url: string): string {
  const href = encodeURI(url);
  return `<a href="${href.replace(/"/g, '&quot;')}" target="_blank" rel="noreferrer noopener">${href.replace(/</g, '&lt;')}</a>`;
}

export function sendLater(input: { channelId: number; text: string; mentions: Mention[]; files: Omit<PendingFile, 'key' | 'attachmentId' | 'ownershipToken'>[]; when: number }) {
  return run(async (account) => {
    const client = chatClient();
    if (!client) throw new Error('signedOut');
    const uploaded = [];
    for (const file of input.files) uploaded.push(await client.upload(input.channelId, { ...file, key: newKey(), attachmentId: null, ownershipToken: null }));
    const used = mentionsInText(input.text, input.mentions);
    await rpc(account, 'discuss.channel', 'kaitech_chat_send_later', [
      [input.channelId],
      {
        body: composeBody(input.text, used),
        partner_ids: used.map((mention) => mention.id),
        attachment_ids: uploaded.map((file) => file.attachmentId),
        attachment_tokens: uploaded.map((file) => file.ownershipToken),
      },
      odooDatetime(input.when),
    ]);
  });
}

export function quickTimes(now: number): { key: 'tomorrow' | 'monday'; when: number }[] {
  const morning = (date: Date) => {
    date.setHours(8, 0, 0, 0);
    return date.getTime();
  };
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monday = new Date(now);
  monday.setDate(monday.getDate() + (((8 - monday.getDay()) % 7) || 7));
  const out: { key: 'tomorrow' | 'monday'; when: number }[] = [{ key: 'tomorrow', when: morning(tomorrow) }];
  if (monday.toDateString() !== tomorrow.toDateString()) out.push({ key: 'monday', when: morning(monday) });
  return out;
}
