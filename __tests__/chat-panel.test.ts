const mockStore = new Map<string, string>();
const mockForgotten: ((id: string) => void)[] = [];
const mockSession = { activeId: 'acct-1' as string | null };

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockStore.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockStore.set(key, value),
    removeItemSync: (key: string) => mockStore.delete(key),
  },
}));
jest.mock('../src/auth/session', () => ({ getSession: () => mockSession, onAccountForgotten: (listener: (id: string) => void) => mockForgotten.push(listener) }));

const { noteEmoji, recentEmoji, rememberSkin, skinFor, supportsSkin, withSkin } = require('../src/features/chat/emoji/emoji') as typeof import('../src/features/chat/emoji/emoji');
const { emojiColumns, emojiRows, halfPanelHeight, handleOutcome, lastPanelTab, problemOf, rememberPanelTab, stickerSections } = require('../src/features/chat/ui/composer/panel/logic') as typeof import('../src/features/chat/ui/composer/panel/logic');

const sticker = (id: number) => ({ source: 'pack' as const, id, packId: 1, alt: `s${id}`, animated: false, width: 512, height: 512, url: `/s/${id}`, poster: `/p/${id}` });

beforeEach(() => {
  mockStore.clear();
  mockSession.activeId = 'acct-1';
});

describe('emoji skin tones', () => {
  it('knows which emoji take a skin tone', () => {
    expect(supportsSkin('👍')).toBe(true);
    expect(supportsSkin('✌️')).toBe(true);
    expect(supportsSkin('😀')).toBe(false);
    expect(supportsSkin('👍🏽')).toBe(false);
    expect(supportsSkin('🇮🇩')).toBe(false);
  });

  it('applies the tone after the base and drops the variation selector', () => {
    expect(withSkin('👍', 3)).toBe('👍🏽');
    expect(withSkin('✌️', 1)).toBe('✌🏻');
    expect(withSkin('😀', 3)).toBe('😀');
    expect(withSkin('👍', 0)).toBe('👍');
  });

  it('remembers the chosen tone per emoji and per account, and forgets it with the account', () => {
    rememberSkin('👍', 4);
    expect(skinFor('👍')).toBe(4);
    expect(skinFor('👋')).toBe(0);
    mockSession.activeId = 'acct-2';
    expect(skinFor('👍')).toBe(0);
    mockSession.activeId = 'acct-1';
    mockForgotten.forEach((listener) => listener('acct-1'));
    expect(skinFor('👍')).toBe(0);
  });

  it('keeps recent emoji per account, newest first, at most 24', () => {
    for (let index = 0; index < 30; index++) noteEmoji(String.fromCodePoint(0x1f600 + index));
    noteEmoji('😀');
    expect(recentEmoji()).toHaveLength(24);
    expect(recentEmoji()[0]).toBe('😀');
    mockSession.activeId = 'acct-2';
    expect(recentEmoji()).toEqual([]);
  });
});

describe('emoji list rows', () => {
  it('puts recent first, then every category with a header and rows of 8', () => {
    const rows = emojiRows(['😀', '👍']);
    expect(rows[0]).toEqual({ type: 'header', section: 'recent' });
    expect(rows[1]).toEqual({ type: 'row', section: 'recent', emojis: ['😀', '👍'] });
    expect(rows[2]).toEqual({ type: 'header', section: 'smileys' });
    expect(rows.filter((row) => row.type === 'row').every((row) => row.type === 'row' && row.emojis.length <= emojiColumns && row.emojis.length > 0)).toBe(true);
    expect(rows.filter((row) => row.type === 'header').map((row) => row.section)).toContain('symbols');
  });

  it('has no recent section when nothing was used yet', () => {
    expect(emojiRows([])[0]).toEqual({ type: 'header', section: 'smileys' });
  });
});

describe('panel', () => {
  it('remembers the last tab per account and forgets it with the account', () => {
    expect(lastPanelTab()).toBe('emoji');
    rememberPanelTab('gif');
    expect(lastPanelTab()).toBe('gif');
    mockSession.activeId = 'acct-2';
    expect(lastPanelTab()).toBe('emoji');
    mockSession.activeId = 'acct-1';
    mockForgotten.forEach((listener) => listener('acct-1'));
    expect(lastPanelTab()).toBe('emoji');
  });

  it('drags the handle 40 dp or flings to change height', () => {
    expect(handleOutcome(-40, 0, false)).toBe('full');
    expect(handleOutcome(-39, 0, false)).toBe('stay');
    expect(handleOutcome(-10, -0.9, false)).toBe('full');
    expect(handleOutcome(40, 0, true)).toBe('half');
    expect(handleOutcome(40, 0, false)).toBe('close');
    expect(handleOutcome(5, 0.9, true)).toBe('half');
  });

  it('opens at the last keyboard height, kept within 260 to 360 dp, and 300 dp without one', () => {
    expect(halfPanelHeight(0)).toBe(300);
    expect(halfPanelHeight(300)).toBe(300);
    expect(halfPanelHeight(200)).toBe(260);
    expect(halfPanelHeight(420)).toBe(360);
  });

  it('orders stickers as favorites, recent, then packs, and skips empty sections', () => {
    const shelf = { packs: [{ id: 1, name: 'Kai', stickers: [sticker(1), sticker(2)] }], recent: [sticker(2)], favorites: [1, 99] };
    const sections = stickerSections(shelf, { favorites: 'Fav', recent: 'Recent' });
    expect(sections.map((section) => section.key)).toEqual(['favorites', 'recent', 'pack-1']);
    expect(sections[0].stickers.map((item) => item.id)).toEqual([1]);
    expect(stickerSections({ packs: [], recent: [], favorites: [] }, { favorites: 'Fav', recent: 'Recent' })).toEqual([]);
  });

  it('tells offline, a missing GIF key and a server failure apart', () => {
    expect(problemOf(null)).toBeNull();
    expect(problemOf({ code: 'network', detail: null })).toBe('offline');
    expect(problemOf({ code: 'refused', detail: 'GIFs are not set up', reason: 'gif_unavailable' })).toBe('unavailable');
    expect(problemOf({ code: 'refused', detail: 'did not answer', reason: 'provider_failed' })).toBe('server');
    expect(problemOf({ code: 'server', detail: null })).toBe('server');
  });
});
