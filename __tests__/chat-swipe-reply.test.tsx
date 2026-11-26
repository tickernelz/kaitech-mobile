const mockTick = jest.fn();
const mockStart = jest.fn();
const mockMotion = { settles: false };
jest.mock('../src/ui/haptic', () => ({ haptic: { tick: () => mockTick(), start: () => mockStart() } }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const animated = (component: unknown) => component;
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: animated },
    createAnimatedComponent: animated,
    isSharedValue: () => false,
    interpolate: (value: number, input: number[], output: number[]) => output[0] + ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
    useSharedValue: (value: unknown) => {
      const { useRef } = jest.requireActual('react');
      const ref = useRef(null);
      if (!ref.current) {
        let current = value;
        ref.current = { get: () => current, set: (next: unknown) => (current = next) };
      }
      return ref.current;
    },
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown, _config: unknown, done?: (finished: boolean) => void) => {
      if (mockMotion.settles) done?.(true);
      return value;
    },
  };
});
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
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
jest.mock('../src/features/chat/ui/Avatar', () => ({ Avatar: () => null }));
require('react-native-gesture-handler/jestSetup');
require('../src/i18n');
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { Message } from '../src/features/chat/types';
const { GestureHandlerRootView, State } = require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');
const { fireGestureHandler, getByGestureTestId } = require('react-native-gesture-handler/jest-utils') as typeof import('react-native-gesture-handler/jest-utils');
const { MessageBubble } = require('../src/features/chat/ui/MessageBubble') as typeof import('../src/features/chat/ui/MessageBubble');
const { replyMax, replyPull, replyReach, replySlop } = require('../src/features/chat/ui/SwipeReply') as typeof import('../src/features/chat/ui/SwipeReply');
type GestureState = (typeof State)[keyof typeof State];

function message(id: number, body: string, type: Message['type'] = 'comment'): Message {
  return { id, channelId: 7, authorId: 40, author: 'Rina Kusuma', body, date: Date.UTC(2026, 10, 25, 3, 0), type, attachments: [], parentId: null, reactions: [] };
}

function bubble(item: Message, onReply?: (message: Message) => void, onLongPress = jest.fn()) {
  return render(
    <GestureHandlerRootView>
    <MessageBubble
      message={item}
      mine={false}
      showAuthor={false}
      readState={null}
      quote={null}
      origin="https://example.test"
      hasThread={false}
      onLongPress={onLongPress}
      onReply={onReply}
      onQuotePress={jest.fn()}
      onReact={jest.fn()}
      onOpenThread={jest.fn()}
    />
    </GestureHandlerRootView>,
  );
}

async function drag(id: number, path: number[], end: GestureState = State.END) {
  const last = path[path.length - 1];
  await act(async () =>
    fireGestureHandler(getByGestureTestId(`message-${id}-swipe`), [
    { state: State.BEGAN, translationX: 0 },
    { state: State.ACTIVE, translationX: path[0] },
    ...path.slice(1).map((translationX) => ({ state: State.ACTIVE, translationX })),
    { state: end, translationX: last },
    ]),
  );
}

const past = replySlop + replyReach + 4;

beforeEach(() => {
  mockMotion.settles = false;
  mockTick.mockClear();
  mockStart.mockClear();
});

describe('swipe right to reply', () => {
  it('replies to the message with one tick when the bubble is pulled past the reach and released', async () => {
    const reply = jest.fn();
    const item = message(51, 'Barang sudah sampai');
    await bubble(item, reply);
    await drag(51, [replySlop + 10, past, past + 30]);
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith(item);
    expect(mockTick).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('message-51-reply-hint')).toBeTruthy();
  });

  it('unmounts the reply icon once the bubble has settled back, so a recycled row carries no hint', async () => {
    mockMotion.settles = true;
    const reply = jest.fn();
    await bubble(message(59, 'Oke'), reply);
    await drag(59, [replySlop + 10, past]);
    expect(reply).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('message-59-reply-hint')).toBeNull();
  });

  it('does not reply when the pull stops short of the reach', async () => {
    const reply = jest.fn();
    await bubble(message(52, 'Oke'), reply);
    await drag(52, [replySlop + 10, replySlop + replyReach - 8]);
    expect(reply).not.toHaveBeenCalled();
    expect(mockTick).not.toHaveBeenCalled();
  });

  it('cancels the reply when the finger slides back under the reach before letting go', async () => {
    const reply = jest.fn();
    await bubble(message(53, 'Oke'), reply);
    await drag(53, [replySlop + 10, past, replySlop + 20]);
    expect(reply).not.toHaveBeenCalled();
    expect(mockTick).toHaveBeenCalledTimes(1);
  });

  it('does not reply when the system cancels the gesture, as when the list takes over the touch', async () => {
    const reply = jest.fn();
    await bubble(message(54, 'Oke'), reply);
    await drag(54, [replySlop + 10, past], State.CANCELLED);
    expect(reply).not.toHaveBeenCalled();
  });

  it('offers no swipe on a deleted message', async () => {
    await bubble(message(55, ''), jest.fn());
    expect(screen.getByTestId('removed-55')).toBeTruthy();
    expect(() => getByGestureTestId('message-55-swipe')).toThrow();
  });

  it('offers no swipe on a system notice', async () => {
    await bubble(message(56, 'Rina joined the channel', 'notification'), jest.fn());
    expect(screen.getByText(/joined the channel/)).toBeTruthy();
    expect(() => getByGestureTestId('message-56-swipe')).toThrow();
  });

  it('offers no swipe when the thread has no composer to reply with', async () => {
    await bubble(message(57, 'Oke'));
    expect(screen.getByTestId('message-57')).toBeTruthy();
    expect(() => getByGestureTestId('message-57-swipe')).toThrow();
  });

  it('follows the finger after the slop, then resists and stops at the cap', () => {
    expect(replyPull(-40)).toBe(0);
    expect(replyPull(replySlop)).toBe(0);
    expect(replyPull(replySlop + 30)).toBe(30);
    expect(replyPull(replySlop + replyReach + 20)).toBeCloseTo(replyReach + 6);
    expect(replyPull(1000)).toBe(replyMax);
  });
});

describe('long press on a message', () => {
  it('vibrates and opens the message actions', async () => {
    const longPress = jest.fn();
    const item = message(58, 'Tolong cek');
    await bubble(item, undefined, longPress);
    await fireEvent(screen.getByTestId('bubble-58'), 'longPress');
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(longPress).toHaveBeenCalledWith(item);
  });
});
