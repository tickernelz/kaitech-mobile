import { forgetChatAccount, openedFolderName, orphanStaging, relativeStaged, stagingName } from '../src/features/chat/cleanup';
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
    const rows = [pending('m1', 'a', ['chat-outbox/1/voice.m4a']), pending('m2', 'a', ['chat-outbox/2/a.jpg', 'chat-outbox/3/b.pdf'])];
    await forgetChatAccount('a', {
      pendingFor: (id) => (id === 'a' ? rows : []),
      dropFile: (uri) => void order.push(`drop ${uri}`),
      forgetDrafts: (id) => void order.push(`drafts ${id}`),
      forgetAccount: async (id) => void order.push(`rows ${id}`),
    });
    expect(order).toEqual(['drop chat-outbox/1/voice.m4a', 'drop chat-outbox/2/a.jpg', 'drop chat-outbox/3/b.pdf', 'drafts a', 'rows a']);
  });
});

describe('staging paths', () => {
  it('stores staged files relative to the documents folder, so an iOS container move keeps them', () => {
    expect(relativeStaged('file:///var/A/Documents/', 'file:///var/A/Documents/chat-outbox/u1/v.m4a')).toBe('chat-outbox/u1/v.m4a');
    expect(relativeStaged('file:///var/A/Documents', 'file:///var/A/Documents/chat-outbox/u1/v.m4a')).toBe('chat-outbox/u1/v.m4a');
    expect(relativeStaged('file:///var/A/Documents/', 'file:///tmp/picked.jpg')).toBe('file:///tmp/picked.jpg');
  });

  it('finds the staging folder of relative and older absolute paths alike', () => {
    expect(stagingName('chat-outbox/u1/v.m4a')).toBe('u1');
    expect(stagingName('file:///var/OLD/Documents/chat-outbox/u2/a.jpg')).toBe('u2');
    expect(stagingName('file:///tmp/picked.jpg')).toBeNull();
  });

  it('keeps folders still referenced by a queued message even after the container path changed', () => {
    const referenced = ['chat-outbox/u2/a.jpg', 'file:///var/OLD/Documents/chat-outbox/u3/b.pdf'];
    expect(orphanStaging(['u1', 'u2', 'u3', 'u4'], referenced)).toEqual(['u1', 'u4']);
  });
});

describe('openedFolderName', () => {
  it('separates accounts and file versions so one download is reused and never shown to another account', () => {
    expect(openedFolderName('u7_abc', 30, 'f00d')).toBe('u7_abc/30-f00d');
    expect(openedFolderName('u7_abc', 30, null)).toBe('u7_abc/30-none');
    expect(openedFolderName('u7_xyz', 30, 'f00d')).not.toBe(openedFolderName('u7_abc', 30, 'f00d'));
  });
});
