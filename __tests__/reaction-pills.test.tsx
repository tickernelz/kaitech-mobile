import '../src/i18n';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, type Insets } from 'react-native';
import type { Message, Reaction } from '../src/features/chat/types';
import { MessageBubble } from '../src/features/chat/ui/MessageBubble';
import { touchTarget } from '../src/ui/touch';

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

type Box = { minWidth?: number; minHeight?: number; columnGap?: number; rowGap?: number; paddingTop?: number; paddingBottom?: number; marginBottom?: number };

function message(reactions: Reaction[]): Message {
  return { id: 9, channelId: 7, authorId: 40, author: 'Rina Kusuma', body: 'Oke, siap', date: Date.UTC(2026, 10, 25, 3, 0), type: 'comment', attachments: [], parentId: null, reactions };
}

async function bubble(reactions: Reaction[], hasThread: boolean, onReact = jest.fn(), onOpenThread = jest.fn()) {
  await render(
    <MessageBubble
      message={message(reactions)}
      mine={false}
      showAuthor={false}
      face="none"
      readState={null}
      quote={null}
      origin="https://lab0.example"
      hasThread={hasThread}
      onLongPress={() => undefined}
      onQuotePress={() => undefined}
      onReact={onReact}
      onOpenThread={onOpenThread}
    />,
  );
  return { onReact, onOpenThread };
}

function pills() {
  return screen.queryAllByRole('button').filter((node) => (StyleSheet.flatten(node.props.style) as Box).minHeight === 32);
}

const two: Reaction[] = [
  { content: '\u{1F44D}', count: 3, mine: false },
  { content: '\u{2764}\u{FE0F}', count: 1, mine: false },
];

describe('reaction pills under a message', () => {
  test('side by side, no pill reaches past the gap into its neighbour', async () => {
    await bubble(two, true);
    const row = pills();
    expect(row).toHaveLength(3);
    const strip = StyleSheet.flatten(row[0].parent?.props.style) as Box;
    for (const pill of row) {
      const slop = pill.props.hitSlop as Insets;
      expect((slop.left ?? 0) + (slop.right ?? 0)).toBeLessThanOrEqual(strip.columnGap ?? 0);
    }
  });

  test('each pill takes at least 44 by 44 dp without reaching into the bubble above', async () => {
    await bubble(two, false);
    const strip = StyleSheet.flatten(pills()[0].parent?.props.style) as Box;
    for (const pill of pills()) {
      const slop = pill.props.hitSlop as Insets;
      expect(32 + (slop.top ?? 0) + (slop.bottom ?? 0)).toBeGreaterThanOrEqual(touchTarget);
      expect((StyleSheet.flatten(pill.props.style) as Box).minWidth).toBeGreaterThanOrEqual(touchTarget);
      expect(slop.top).toBeLessThanOrEqual(strip.paddingTop ?? 0);
    }
  });

  test('the reach below a pill stays inside its own message, so the next message cannot take it', async () => {
    await bubble(two, false);
    const strip = StyleSheet.flatten(pills()[0].parent?.props.style) as Box;
    const slop = pills()[0].props.hitSlop as Insets;
    expect(strip.paddingBottom).toBeGreaterThanOrEqual(slop.bottom ?? 0);
    expect(strip.marginBottom ?? 0).toBe(0);
  });

  test('wrapped rows of pills sit far enough apart that neither row reaches into the other', async () => {
    await bubble(two, false);
    const strip = StyleSheet.flatten(pills()[0].parent?.props.style) as Box;
    const slop = pills()[0].props.hitSlop as Insets;
    expect(strip.rowGap).toBeGreaterThanOrEqual((slop.top ?? 0) + (slop.bottom ?? 0));
  });

  test('a tap reacts with the pill that was tapped, and the thread pill opens the thread', async () => {
    const { onReact, onOpenThread } = await bubble(two, true);
    await act(async () => fireEvent.press(pills()[0]));
    expect(onReact).toHaveBeenCalledTimes(1);
    expect(onReact.mock.calls[0][1]).toBe('\u{1F44D}');
    await act(async () => fireEvent.press(pills()[2]));
    expect(onOpenThread).toHaveBeenCalledTimes(1);
  });

  test('a message without reactions or thread shows no pills', async () => {
    await bubble([], false);
    expect(pills()).toHaveLength(0);
  });
});
