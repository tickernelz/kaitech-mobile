import '../src/i18n';
import { render, screen } from '@testing-library/react-native';
import { processColor, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { Message, Pending } from '../src/features/chat/types';
import { MessageBubble, PendingBubble, tailReach } from '../src/features/chat/ui/MessageBubble';
import { colorsFor } from '../src/theme/tokens';

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined } }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/features/call/call', () => ({ callState: () => ({ phase: 'idle' }), startCall: jest.fn() }));
jest.mock('../src/features/chat/chat', () => ({ conversationById: () => null, getChat: () => null }));
jest.mock('../src/features/chat/ui/MediaControls', () => ({ UploadProgress: () => null }));
jest.mock('../src/features/chat/ui/VoiceNote', () => ({ VoiceNote: () => null }));
jest.mock('../src/features/call/ui/RecordingCard', () => ({ RecordingCard: () => null }));
jest.mock('../src/features/chat/ui/useOpenAttachment', () => ({ useOpenAttachment: () => () => undefined }));
jest.mock('../src/features/chat/ui/useCookie', () => ({ useCookie: () => null }));
jest.mock('../src/features/chat/ui/coworker/Cards', () => ({ AgentSaid: () => null }));
jest.mock('../src/features/chat/ui/SwipeReply', () => ({ SwipeReply: ({ children }: { children: unknown }) => children }));

const colors = colorsFor('light');
const corners = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius', 'borderTopStartRadius', 'borderTopEndRadius', 'borderBottomStartRadius', 'borderBottomEndRadius'] as const;

function message(): Message {
  return { id: 9, channelId: 7, authorId: 40, author: 'Rina Kusuma', body: 'Oke, siap', date: Date.UTC(2026, 10, 25, 3, 0), type: 'comment', attachments: [], parentId: null, reactions: [] };
}

function pending(state: Pending['state'], rich?: Pending['rich']): Pending {
  return { key: 'k', accountId: 'a', channelId: 7, text: rich ? '' : 'Oke, siap', parentId: null, mentions: [], files: [], createdAt: 0, attempts: 1, state, error: null, rich };
}

async function sent(mine: boolean, tail = true) {
  await render(
    <MessageBubble
      message={message()}
      mine={mine}
      showAuthor={false}
      tail={tail}
      readState={null}
      quote={null}
      origin="https://lab0.example"
      hasThread={false}
      onLongPress={() => undefined}
      onQuotePress={() => undefined}
      onReact={() => undefined}
      onOpenThread={() => undefined}
    />,
  );
  return screen.getByTestId('bubble-9');
}

const flat = (style: StyleProp<ViewStyle>): ViewStyle => StyleSheet.flatten(style) ?? {};

type Paint = { payload?: number } | null | undefined;

function tail() {
  const node = screen.queryByTestId('bubble-tail', { includeHiddenElements: true });
  if (!node) return null;
  type Node = { type: unknown; props: Record<string, unknown>; children?: (Node | string)[] };
  const walk = (at: Node): Node[] => [at, ...(at.children ?? []).flatMap((child) => (typeof child === 'string' ? [] : walk(child)))];
  const paths = walk(node as unknown as Node).filter((child) => child.type === 'RNSVGPath');
  const fill = paths.find((path) => !path.props.stroke);
  const edge = paths.find((path) => !!path.props.stroke);
  return { style: flat(node.props.style), fill: (fill?.props.fill as Paint)?.payload, edge: (edge?.props.stroke as Paint)?.payload };
}

const paint = (color: string) => processColor(color);

describe('message bubble tail', () => {
  test.each([true, false])('mine=%s keeps one radius on every corner, so Android draws a rounded rect and not a path mask', async (mine) => {
    const style = flat((await sent(mine)).props.style);
    expect(style.borderRadius).toBeGreaterThan(0);
    for (const corner of corners) expect(style[corner]).toBeUndefined();
  });

  test('a bubble inside a group, not its last, draws no tail', async () => {
    await sent(false, false);
    expect(tail()).toBeNull();
  });

  test('my last message points its tail out of the bottom right corner in the bubble colour, without an edge', async () => {
    await sent(true);
    const drawn = tail();
    expect(drawn?.style).toMatchObject({ position: 'absolute', bottom: 0, right: -tailReach, transform: [{ scaleX: -1 }] });
    expect(drawn?.style.left).toBeUndefined();
    expect(drawn?.fill).toBe(paint(colors.select));
    expect(drawn?.edge).toBeUndefined();
  });

  test('a last message from someone else points its tail left, toward the photo, with the bubble edge along its curve', async () => {
    await sent(false);
    const drawn = tail();
    expect(drawn?.style).toMatchObject({ position: 'absolute', bottom: 0, left: -tailReach });
    expect(drawn?.style.right).toBeUndefined();
    expect(drawn?.fill).toBe(paint(colors.surface));
    expect(drawn?.edge).toBe(paint(colors.line));
  });

  test('a failed send keeps the danger edge on its tail', async () => {
    await render(<PendingBubble pending={pending('failed')} offline={false} origin="https://lab0.test" onRetry={() => undefined} onDiscard={() => undefined} />);
    const drawn = tail();
    expect(drawn?.edge).toBe(paint(colors.danger));
    expect(drawn?.fill).toBe(paint(colors.select));
  });

  test('a sticker without a bubble draws no tail', async () => {
    const sticker = { source: 'pack' as const, id: 1, packId: 1, alt: 'ok', animated: false, width: 128, height: 128, url: '/s.webp', poster: '/s.webp' };
    await render(<PendingBubble pending={pending('sending', { sticker })} offline={false} origin="https://lab0.test" onRetry={() => undefined} onDiscard={() => undefined} />);
    expect(screen.getByTestId('bubble-pending')).toBeTruthy();
    expect(tail()).toBeNull();
  });
});
