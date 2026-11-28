import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import '../src/i18n';
import type { StickerShelf } from '../src/features/chat/composerExtras';
import type { Message, Sticker } from '../src/features/chat/types';
import { EmojiGrid } from '../src/features/chat/ui/EmojiPicker';
import { MessageActions } from '../src/features/chat/ui/MessageActions';
import { EmojiTab } from '../src/features/chat/ui/composer/panel/EmojiTab';
import { StickerTab } from '../src/features/chat/ui/composer/panel/StickerTab';
import { colorsFor } from '../src/theme/tokens';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return { __esModule: true, default: { View }, Easing: chain(), withTiming: (value: unknown) => value, useReducedMotion: () => true, useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }), useAnimatedStyle: (style: () => object) => style() };
});
jest.mock('@shopify/flash-list', () => {
  const { createElement, forwardRef, useImperativeHandle } = jest.requireActual('react');
  const { FlatList } = jest.requireActual('react-native');
  return {
    FlashList: forwardRef((props: object, ref: unknown) => {
      useImperativeHandle(ref, () => ({ scrollToIndex: () => undefined }));
      return createElement(FlatList, props);
    }),
  };
});
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));
jest.mock('../src/auth/session', () => ({ getSession: () => ({ activeId: 'a' }), onAccountForgotten: () => undefined }));
jest.mock('../src/features/chat/ui/useCookie', () => ({ useCookie: () => undefined }));
jest.mock('../src/ui/Sheet', () => {
  const { View } = jest.requireActual('react-native');
  return { Sheet: ({ children }: { children: unknown }) => <View>{children as never}</View>, SheetItem: () => null };
});

const colors = colorsFor('light');

type Node = { props: { style?: StyleProp<ViewStyle> }; children: readonly (Node | string)[] };

function outlined(node: Node): boolean {
  const style = StyleSheet.flatten(node.props.style) ?? {};
  if (style.borderColor === colors.focus && style.borderWidth === 2 && style.backgroundColor === colors.select) return true;
  return node.children.some((child) => typeof child !== 'string' && outlined(child));
}

function expectOnlySelectedOutlined(role: 'button' | 'tab') {
  const on = screen.getAllByRole(role, { selected: true });
  const off = screen.getAllByRole(role, { selected: false });
  expect(on.length).toBeGreaterThan(0);
  expect(off.length).toBeGreaterThan(0);
  for (const node of on) expect(outlined(node)).toBe(true);
  for (const node of off) expect(outlined(node)).toBe(false);
}

describe('selected cells draw the focus outline, not the select fill alone', () => {
  it('marks the picked emoji in the emoji grid', async () => {
    await render(<EmojiGrid onPick={() => undefined} selected={['\u{1F600}']} />);
    await fireEvent.press(screen.getByTestId('emoji-tab-smileys'));
    expectOnlySelectedOutlined('button');
  });

  it('marks the reaction the reader already gave', async () => {
    const message = { id: 1, channelId: 1, authorId: 2, author: 'Rina', body: 'ok', date: 0, type: 'comment', attachments: [], parentId: null, reactions: [{ content: '\u{1F44D}', count: 1, mine: true }] } as unknown as Message;
    await render(<MessageActions message={message} mine={false} readers={0} options={{}} onClose={() => undefined} onReact={() => undefined} onAction={() => undefined} />);
    expectOnlySelectedOutlined('button');
  });

  it('marks the emoji category in view', async () => {
    await render(<EmojiTab onPick={() => undefined} onBackspace={() => undefined} onSearching={() => undefined} stickers={[]} origin="https://lab0.test" onSticker={() => undefined} onSearchGif={() => undefined} />);
    expectOnlySelectedOutlined('tab');
  });

  it('marks the sticker source in view, icon, cover or text alike', async () => {
    const sticker = { source: 'pack', id: 1, packId: 7, alt: 'kucing', animated: false, width: 128, height: 128, url: '/s/1.webp', poster: '/s/1.png' } satisfies Sticker;
    const shelf = { ok: true as const, value: { packs: [{ id: 7, name: 'Kucing', stickers: [sticker] }], recent: [sticker], favorites: [1] } satisfies StickerShelf };
    await render(<StickerTab shelf={shelf} origin="https://lab0.test" onPick={() => undefined} onSearching={() => undefined} onShelfChanged={() => undefined} />);
    expectOnlySelectedOutlined('tab');
    await fireEvent.press(screen.getByTestId('sticker-source-pack-7'));
    expectOnlySelectedOutlined('tab');
    expect(outlined(screen.getByTestId('sticker-source-pack-7'))).toBe(true);
    await fireEvent.press(screen.getByTestId('sticker-source-provider'));
    expectOnlySelectedOutlined('tab');
    expect(outlined(screen.getByTestId('sticker-source-provider'))).toBe(true);
  });
});
