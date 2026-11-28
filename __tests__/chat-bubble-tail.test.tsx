import '../src/i18n';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { Message, Pending } from '../src/features/chat/types';
import { MessageBubble, PendingBubble } from '../src/features/chat/ui/MessageBubble';
import { colorsFor, stroke } from '../src/theme/tokens';

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

async function sent(mine: boolean) {
  await render(
    <MessageBubble
      message={message()}
      mine={mine}
      showAuthor={false}
      face="none"
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

function parts() {
  const style = (id: string) => {
    const node = screen.queryByTestId(id);
    return node ? flat(node.props.style) : null;
  };
  return { fill: style('bubble-tail'), edge: style('bubble-tail-edge') };
}

describe('message bubble corner', () => {
  test.each([true, false])('mine=%s keeps one radius on every corner, so Android draws a rounded rect and not a path mask', async (mine) => {
    const style = flat((await sent(mine)).props.style);
    expect(style.borderRadius).toBeGreaterThan(0);
    for (const corner of corners) expect(style[corner]).toBeUndefined();
  });

  test('my message draws the small corner bottom right in the bubble colour, without an edge', async () => {
    await sent(true);
    const { fill, edge } = parts();
    expect(fill).toMatchObject({ bottom: 0, backgroundColor: colors.select });
    expect(fill?.right).toBeCloseTo(0);
    expect(fill?.left).toBeUndefined();
    expect(edge).toBeNull();
  });

  test('a message from someone else draws the small corner bottom left with its edge, as wide as the bubble outline, outside the fill', async () => {
    await sent(false);
    const { fill, edge } = parts();
    expect(fill).toMatchObject({ left: 0, bottom: 0, backgroundColor: colors.surface });
    expect(edge).toMatchObject({ left: -stroke.thin, bottom: -stroke.thin, backgroundColor: colors.line });
    expect(edge?.right).toBeUndefined();
  });

  test('a failed send keeps the danger edge on the small corner', async () => {
    await render(<PendingBubble pending={pending('failed')} offline={false} origin="https://lab0.test" onRetry={() => undefined} onDiscard={() => undefined} />);
    const { fill, edge } = parts();
    expect(edge?.backgroundColor).toBe(colors.danger);
    expect(fill?.backgroundColor).toBe(colors.select);
  });

  test('a sticker without a bubble draws no corner', async () => {
    const sticker = { source: 'pack' as const, id: 1, packId: 1, alt: 'ok', animated: false, width: 128, height: 128, url: '/s.webp', poster: '/s.webp' };
    await render(<PendingBubble pending={pending('sending', { sticker })} offline={false} origin="https://lab0.test" onRetry={() => undefined} onDiscard={() => undefined} />);
    expect(screen.getByTestId('bubble-pending')).toBeTruthy();
    expect(screen.queryByTestId('bubble-tail')).toBeNull();
    expect(screen.queryByTestId('bubble-tail-edge')).toBeNull();
  });
});
