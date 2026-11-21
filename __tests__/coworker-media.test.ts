import { limitsOf } from '../src/features/chat/uploadRule';
import { chatAttachments } from '../src/features/discovery/files';

describe('upload limits from the server', () => {
  it('reads each kind that has a positive whole byte count and ignores the rest', () => {
    expect(limitsOf({ coworker: { max_bytes: 26214400 }, chat: { max_bytes: '5' } })).toEqual({ coworker: 26214400 });
    expect(limitsOf({ chat: { max_bytes: 0 }, coworker: { max_bytes: 1.5 } })).toEqual({});
    expect(limitsOf(null)).toEqual({});
  });
});

describe('Coworker files in the chat bubble', () => {
  it('opens the stored attachment, never the source document id, and plays audio as a voice note', () => {
    const shown = chatAttachments([
      { id: 3, attachmentId: 41, name: 'voice.m4a', mimetype: 'audio/mp4', size: 900, sizeLabel: '900 B' },
      { id: 4, name: 'old.pdf', mimetype: 'application/pdf', sizeLabel: '1 KB' },
    ]);
    expect(shown).toEqual([{ id: 41, name: 'voice.m4a', mimetype: 'audio/mp4', size: 900, voice: true, accessToken: null, checksum: null, url: null }]);
  });
});
