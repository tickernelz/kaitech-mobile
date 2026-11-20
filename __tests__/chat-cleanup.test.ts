import { forgetChatAccount, orphanStaging } from '../src/features/chat/cleanup';
import type { Pending } from '../src/features/chat/types';

function pending(key: string, accountId: string, uris: string[]): Pending {
  return {
    key,
    accountId,
    channelId: 1,
    text: '',
    parentId: null,
    mentions: [],
    files: uris.map((uri, index) => ({ key: `${key}-${index}`, uri, name: 'f', mimetype: 'audio/mp4', size: 1, voice: true, durationMs: 1, attachmentId: null, ownershipToken: null })),
    createdAt: 0,
    attempts: 0,
    state: 'queued',
    error: null,
  };
}

describe('forgetChatAccount', () => {
  it('deletes the staged files of unsent messages before dropping the rows', async () => {
    const order: string[] = [];
    const rows = [pending('m1', 'a', ['file:///d/chat-outbox/1/voice.m4a']), pending('m2', 'a', ['file:///d/chat-outbox/2/a.jpg', 'file:///d/chat-outbox/3/b.pdf'])];
    await forgetChatAccount('a', {
      pendingFor: (id) => (id === 'a' ? rows : []),
      dropFile: (uri) => void order.push(`drop ${uri}`),
      forgetDrafts: (id) => void order.push(`drafts ${id}`),
      forgetAccount: async (id) => void order.push(`rows ${id}`),
    });
    expect(order).toEqual([
      'drop file:///d/chat-outbox/1/voice.m4a',
      'drop file:///d/chat-outbox/2/a.jpg',
      'drop file:///d/chat-outbox/3/b.pdf',
      'drafts a',
      'rows a',
    ]);
  });
});

describe('orphanStaging', () => {
  it('keeps folders still referenced by a queued message and returns the rest', () => {
    const folders = ['file:///d/chat-outbox/1/', 'file:///d/chat-outbox/2/', 'file:///d/chat-outbox/3'];
    expect(orphanStaging(folders, ['file:///d/chat-outbox/2/a.jpg'])).toEqual(['file:///d/chat-outbox/1/', 'file:///d/chat-outbox/3']);
  });
});
