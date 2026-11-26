import { fromCache, toCache } from '../src/features/chat/rich';
import type { Message, Rich } from '../src/features/chat/types';

const base: Message = { id: 901, channelId: 12, authorId: 7, author: 'Ana', body: 'Lunch where?', date: 0, type: 'comment', attachments: [], parentId: null, reactions: [] };
const poll: Rich = { poll: { question: 'Lunch where?', multiple: false, closed: false, closedAt: null, votersCount: 0, options: [{ id: 41, label: 'Padang', votes: 0, voters: [] }] } };
const sticker: Rich = { sticker: { source: 'pack', id: 5, packId: 1, alt: 'Thumbs up', animated: false, width: 512, height: 512, url: '/s.webp', poster: '/s.webp' } };

function stored(message: Message): ReturnType<typeof toCache<Message>> {
  return JSON.parse(JSON.stringify(toCache(message)));
}

describe('cached chat rows', () => {
  it('keeps polls and locations out of the rich field that 0.8.0 reads, and reads them back', () => {
    const row = stored({ ...base, rich: poll });
    expect('rich' in row).toBe(false);
    expect(fromCache<Message>(row)).toEqual({ ...base, rich: poll });
  });

  it('keeps stickers and GIFs where 0.8.0 expects them', () => {
    const row = stored({ ...base, rich: sticker });
    expect(row.rich).toEqual(sticker);
    expect(fromCache<Message>(row).rich).toEqual(sticker);
  });

  it('drops a rich value of a kind this build does not know instead of rendering it', () => {
    expect(fromCache<Message>({ ...base, content: { vote: { id: 1 } } })).toEqual(base);
    expect(fromCache<Message>({ ...base, rich: { poll: { question: 'q' } } })).toEqual(base);
    expect(fromCache<Message>({ ...base, rich: { gif: { id: 'x' } } })).toEqual(base);
  });

  it('reads rows written by 0.8.0 unchanged', () => {
    expect(fromCache<Message>(JSON.parse(JSON.stringify(base)))).toEqual(base);
  });
});
