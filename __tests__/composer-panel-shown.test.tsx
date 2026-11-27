import { createElement, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import '../src/i18n';
import type { StickerShelf } from '../src/features/chat/composerExtras';
import type { Result } from '../src/features/chat/messageActions';
import { ComposerPanel } from '../src/features/chat/ui/composer/Panel';
import { PanelShown, useVisiblePlaying, useWhenPanelShows } from '../src/features/chat/ui/composer/panel/paging';

let mockReduce = false;
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: { View }, Easing: { bezier: () => () => 0, out: () => () => 0 }, withTiming: (value: unknown) => value, useReducedMotion: () => mockReduce };
});
jest.mock('@shopify/flash-list', () => ({ FlashList: jest.requireActual('react-native').FlatList }));
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: jest.fn(), removeItemSync: jest.fn() } }));
jest.mock('../src/auth/session', () => ({ getSession: () => ({ activeId: 'a' }), onAccountForgotten: jest.fn() }));
const mockShelves: Result<StickerShelf>[] = [];
const mockStickerShelf = jest.fn(async () => mockShelves.shift() ?? { ok: true as const, value: { packs: [], recent: [], favorites: [] } });
jest.mock('../src/features/chat/composerExtras', () => ({ stickerShelf: () => mockStickerShelf() }));
const mockSeen: (Result<StickerShelf> | null)[] = [];
jest.mock('../src/features/chat/ui/composer/panel/EmojiTab', () => ({ EmojiTab: () => null }));
jest.mock('../src/features/chat/ui/composer/panel/GifTab', () => ({ GifTab: () => null }));
jest.mock('../src/features/chat/ui/composer/panel/StickerTab', () => ({
  StickerTab: ({ shelf }: { shelf: Result<StickerShelf> | null }) => {
    mockSeen.push(shelf);
    return null;
  },
}));


const shelf = (favorites: number[]): Result<StickerShelf> => ({ ok: true, value: { packs: [], recent: [], favorites } });

function panel(shown: boolean) {
  return createElement(ComposerPanel, {
    shown,
    origin: 'https://lab0.test',
    full: false,
    searching: false,
    onEmoji: jest.fn(),
    onBackspace: jest.fn(),
    onSticker: jest.fn(),
    onGif: jest.fn(),
    onSearching: jest.fn(),
    onSize: jest.fn(),
  });
}

const flush = () => act(async () => undefined);

beforeEach(() => {
  mockShelves.length = 0;
  mockSeen.length = 0;
  mockStickerShelf.mockClear();
  mockReduce = false;
});

describe('emoji panel kept mounted while closed', () => {
  test('a sticker saved while the panel was closed is on the shelf when the panel opens again', async () => {
    mockShelves.push(shelf([]), shelf([42]));
    await render(panel(true));
    await fireEvent.press(screen.getByTestId('panel-tab-sticker'));
    await flush();
    expect(mockSeen.at(-1)).toEqual(shelf([]));
    await screen.rerender(panel(false));
    await flush();
    expect(mockStickerShelf).toHaveBeenCalledTimes(1);
    await screen.rerender(panel(true));
    await flush();
    expect(mockStickerShelf).toHaveBeenCalledTimes(2);
    expect(mockSeen.at(-1)).toEqual(shelf([42]));
  });

  test('a failed refresh on reopening replaces the shelf with the failure the tab shows', async () => {
    const offline: Result<StickerShelf> = { ok: false, code: 'offline', detail: null };
    mockShelves.push(shelf([7]), offline);
    await render(panel(true));
    await fireEvent.press(screen.getByTestId('panel-tab-sticker'));
    await flush();
    await screen.rerender(panel(false));
    await screen.rerender(panel(true));
    await flush();
    expect(mockSeen.at(-1)).toEqual(offline);
  });

  test('an unchanged shelf on reopening does not render the sticker tab again', async () => {
    mockShelves.push(shelf([5]), shelf([5]));
    await render(panel(true));
    await fireEvent.press(screen.getByTestId('panel-tab-sticker'));
    await flush();
    await screen.rerender(panel(false));
    const before = mockSeen.length;
    const seenBefore = mockSeen.at(-1);
    await screen.rerender(panel(true));
    await flush();
    expect(mockStickerShelf).toHaveBeenCalledTimes(2);
    expect(mockSeen.slice(before).every((seen) => seen === seenBefore)).toBe(true);
  });
});

describe('panel state across closing and opening', () => {
  function Probe({ shows, hides }: { shows: () => void; hides: () => void }) {
    useWhenPanelShows(shows, hides);
    return null;
  }
  const probe = (shown: boolean, shows: () => void, hides: () => void) => createElement(PanelShown.Provider, { value: shown }, createElement(Probe, { shows, hides }));

  test('nothing runs on the first render, hiding and showing each run once per change', async () => {
    const shows = jest.fn();
    const hides = jest.fn();
    await render(probe(true, shows, hides));
    expect(shows).not.toHaveBeenCalled();
    expect(hides).not.toHaveBeenCalled();
    await screen.rerender(probe(true, shows, hides));
    await screen.rerender(probe(false, shows, hides));
    expect(hides).toHaveBeenCalledTimes(1);
    await screen.rerender(probe(false, shows, hides));
    await screen.rerender(probe(true, shows, hides));
    expect(shows).toHaveBeenCalledTimes(1);
    expect(hides).toHaveBeenCalledTimes(1);
  });

  test('an emoji search typed before closing is cleared when the panel opens again', async () => {
    const { EmojiTab } = jest.requireActual('../src/features/chat/ui/composer/panel/EmojiTab') as typeof import('../src/features/chat/ui/composer/panel/EmojiTab');
    const tab = (shown: boolean) =>
      createElement(PanelShown.Provider, { value: shown }, createElement(EmojiTab, { onPick: jest.fn(), onBackspace: jest.fn(), onSearching: jest.fn(), stickers: [], origin: '', onSticker: jest.fn(), onSearchGif: jest.fn() }));
    await render(tab(true));
    await fireEvent.changeText(screen.getByTestId('emoji-search'), 'kucing');
    expect(screen.getByTestId('emoji-results')).toBeTruthy();
    await screen.rerender(tab(false));
    await screen.rerender(tab(true));
    expect(screen.getByTestId('emoji-search').props.value).toBe('');
    expect(screen.queryByTestId('emoji-results')).toBeNull();
  });
});

describe('animated stickers and GIFs in the panel', () => {
  beforeAll(() => {
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  });

  const wrap = (shown: boolean) =>
    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(PanelShown.Provider, { value: shown }, children);
    };

  test('visible cells play while the panel is shown', async () => {
    const { result } = await renderHook(() => useVisiblePlaying(), { wrapper: wrap(true) });
    await act(async () => result.current.onViewableItemsChanged({ viewableItems: [{ key: 'g1', isViewable: true }] }));
    expect(result.current.isPlaying('g1')).toBe(true);
    expect(result.current.isPlaying('g2')).toBe(false);
  });

  test('no cell plays behind a closed panel, even when its list still reports it viewable', async () => {
    const { result } = await renderHook(() => useVisiblePlaying(), { wrapper: wrap(false) });
    await act(async () => result.current.onViewableItemsChanged({ viewableItems: [{ key: 'g1', isViewable: true }] }));
    expect(result.current.isPlaying('g1')).toBe(false);
  });
});
