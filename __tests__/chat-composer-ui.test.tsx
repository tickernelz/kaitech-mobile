import { createElement } from 'react';
import { View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import '../src/i18n';

const mockSend = jest.fn(async () => 'key');
const mockSendVoice = jest.fn();
const mockDiscard = jest.fn();
const mockStartLocked = jest.fn();
const mockKeyboard = { isVisible: false, height: 0 };
let mockVoiceState: { phase: string; locked?: boolean; reason?: string | null } = { phase: 'idle' };

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    Easing: chain(),
    FadeIn: chain(),
    FadeOut: chain(),
    withRepeat: (value: unknown) => value,
    withSequence: (...values: unknown[]) => values[values.length - 1],
    withDelay: (_delay: number, value: unknown) => value,
    interpolate: (value: number, input: number[], output: number[]) => output[0] + ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
    useReducedMotion: () => true,
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
    withTiming: (value: unknown) => value,
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardController: { dismiss: jest.fn(async () => undefined) },
  useKeyboardState: (select: (state: { isVisible: boolean; height: number }) => unknown) => select(mockKeyboard),
  useReanimatedKeyboardAnimation: () => ({ height: { get: () => 0 }, progress: { get: () => 0 } }),
}));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: jest.fn(), removeItemSync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
const mockRequestCamera = jest.fn(async () => ({ granted: false, canAskAgain: true }));
jest.mock('expo-image-picker', () => ({
  getCameraPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
  requestCameraPermissionsAsync: () => mockRequestCamera(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
const mockDocuments = jest.fn(async (_options: unknown) => ({ canceled: true, assets: [] }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (options: unknown) => mockDocuments(options) }));
jest.mock('../src/api/odoo', () => ({ route: jest.fn(), rpc: jest.fn(), ApiError: class extends Error {}, onSessionOpened: jest.fn() }));
jest.mock('../src/auth/session', () => ({ onAccountForgotten: jest.fn(), useSession: () => ({ active: null }) }));
jest.mock('../src/features/chat/chat', () => ({
  chatClient: () => null,
  notifyTyping: jest.fn(),
  send: (...args: unknown[]) => mockSend(...(args as [])),
  useChat: (select: (state: unknown) => unknown) => select({ features: { on: [], isAdmin: false, urgentLeft: null }, origin: 'https://lab0.test' }),
}));
jest.mock('../src/features/chat/drafts', () => ({ readDraft: () => ({ text: '', mentions: [], parentId: null }), writeDraft: jest.fn(), clearDraft: jest.fn() }));
jest.mock('../src/features/chat/push', () => ({ askForPushOnce: jest.fn() }));
jest.mock('../src/features/chat/limits', () => ({ useUploadLimit: () => null }));
jest.mock('../src/features/chat/files', () => ({ dropFile: jest.fn(), stageFile: jest.fn() }));
jest.mock('../src/features/chat/ui/composer/useVoiceRecorder', () => {
  const { ClockStore } = jest.requireActual('../src/features/chat/voice/clock');
  const clock = new ClockStore();
  const value = (initial: number) => ({ get: () => initial, set: () => undefined });
  return {
    useVoiceRecorder: () => ({
      state: mockVoiceState,
      clock,
      dx: value(0),
      dy: value(0),
      level: value(0),
      hint: false,
      draftUri: null,
      hold: {},
      startLocked: mockStartLocked,
      pause: jest.fn(),
      resume: jest.fn(),
      send: mockSendVoice,
      discard: mockDiscard,
    }),
  };
});
jest.mock('../src/features/chat/voicePlayer', () => ({ useVoice: () => ({ id: null, playing: false, position: 0, duration: 0, rate: 1, loading: false }), toggleVoice: jest.fn(), seekVoice: jest.fn(), stopVoice: jest.fn() }));
jest.mock('../src/features/chat/ui/useVoiceHold', () => ({ cancelDistance: 96, useVoiceHold: jest.fn() }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('../src/features/call/call', () => ({ callState: () => ({ phase: 'idle' }), subscribeCall: () => () => undefined }));
jest.mock('../src/features/call/ui/useAutoHide', () => ({ useScreenReader: () => false }));
jest.mock('../src/features/chat/ui/composer/Panel', () => ({ ComposerPanel: () => null }));

const { Composer } = require('../src/features/chat/ui/Composer') as typeof import('../src/features/chat/ui/Composer');
const { DialogLayer } = require('../src/ui/Dialog') as typeof import('../src/ui/Dialog');

const hidden = { includeHiddenElements: true };

async function show() {
  await render(createElement(View, null, createElement(Composer, { accountId: 'a', channelId: 12, messages: [], onSent: jest.fn() }), createElement(DialogLayer, { root: true })));
}

function visible(testID: string): boolean {
  const node = screen.getByTestId(testID, hidden);
  let current: typeof node | null = node;
  while (current) {
    if (current.props.importantForAccessibility === 'no-hide-descendants' || current.props.pointerEvents === 'none') return false;
    current = current.parent;
  }
  return true;
}

beforeEach(() => {
  mockVoiceState = { phase: 'idle' };
  mockKeyboard.isVisible = false;
  mockSend.mockClear();
});

describe('adaptive composer', () => {
  it('shows mic and camera on an empty field, send without camera while typing, and returns when cleared', async () => {
    await show();
    const input = screen.getByTestId('composer-input');
    expect(visible('composer-mic')).toBe(true);
    expect(visible('composer-camera')).toBe(true);
    expect(screen.queryByTestId('composer-send', hidden)).not.toBeNull();
    expect(visible('composer-send')).toBe(false);

    await fireEvent.changeText(input, '   ');
    expect(visible('composer-mic')).toBe(true);
    expect(visible('composer-camera')).toBe(true);

    await fireEvent.changeText(input, 'halo');
    expect(visible('composer-send')).toBe(true);
    expect(visible('composer-mic')).toBe(false);
    expect(visible('composer-camera')).toBe(false);

    await fireEvent.changeText(input, '');
    expect(visible('composer-mic')).toBe(true);
    expect(visible('composer-camera')).toBe(true);
  });

  it('keeps one 44 dp slot for mic and send so the row does not move', async () => {
    await show();
    const slot = screen.getByTestId('composer-send-slot', hidden);
    expect(slot.props.style).toMatchObject({ width: 44, height: 44 });
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'halo');
    expect(screen.getByTestId('composer-send-slot', hidden).props.style).toMatchObject({ width: 44, height: 44 });
  });

  it('sends the typed text and goes back to the microphone', async () => {
    await show();
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'halo');
    await fireEvent.press(screen.getByTestId('composer-send'));
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ channelId: 12, text: 'halo', files: [] }), expect.any(Number));
    expect(visible('composer-mic')).toBe(true);
  });

  it('explains the camera in the Kaitech card first and stages nothing when the user declines', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('composer-camera'));
    expect(await screen.findByTestId('permission-camera-dialog-title')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('permission-camera-dialog-cancel'));
    expect(mockRequestCamera).not.toHaveBeenCalled();
    expect(screen.queryByTestId('staged-file')).toBeNull();
    expect(visible('composer-mic')).toBe(true);
  });

  it('turns a locked recording into discard, pause and send-voice controls in the same 44 dp row', async () => {
    mockVoiceState = { phase: 'recording', locked: true };
    await show();
    expect(screen.getByTestId('voice-recording-locked')).toBeTruthy();
    expect(screen.queryByTestId('composer-attach')).toBeNull();
    expect(visible('composer-send-voice')).toBe(true);
    expect(visible('composer-mic')).toBe(false);
    await fireEvent.press(screen.getByTestId('voice-discard'));
    expect(mockDiscard).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId('composer-send-voice'));
    expect(mockSendVoice).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('composer-send-slot', hidden).props.style).toMatchObject({ width: 44, height: 44 });
  });

  it('shows the paused draft with its interruption banner and the send-voice button', async () => {
    mockVoiceState = { phase: 'paused', reason: 'call' };
    await show();
    expect(screen.getByTestId('voice-paused')).toBeTruthy();
    expect(screen.getByTestId('voice-interrupted-call')).toBeTruthy();
    expect(screen.getByTestId('voice-draft-play')).toBeTruthy();
    expect(visible('composer-send-voice')).toBe(true);
  });

  it('opens the attach sheet with gallery, camera, document and audio, and audio picks only audio files', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('composer-attach'));
    for (const source of ['photos', 'camera', 'files', 'audio']) expect(screen.getByTestId(`attach-${source}`)).toBeTruthy();
    expect(screen.getByText('Photos and videos are picked with the system photo picker. Kaitech does not ask for access to your whole gallery.')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('attach-audio'));
    expect(mockDocuments).toHaveBeenCalledWith(expect.objectContaining({ type: 'audio/*', multiple: true }));
    expect(screen.queryByTestId('staged-file')).toBeNull();
  });

  it('switches the field button between the panel and the keyboard', async () => {
    await show();
    expect(screen.getByLabelText('Emoji, stickers and GIFs')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('composer-panel-toggle'));
    expect(screen.getByTestId('composer-keyboard')).toBeTruthy();
    expect(screen.getByLabelText('Show keyboard')).toBeTruthy();
  });

  it('closes the panel when the message field is tapped while the emoji search already holds the keyboard', async () => {
    await show();
    await fireEvent.press(screen.getByTestId('composer-panel-toggle'));
    expect(screen.getByTestId('composer-keyboard')).toBeTruthy();
    mockKeyboard.isVisible = true;
    await screen.rerender(createElement(View, null, createElement(Composer, { accountId: 'a', channelId: 12, messages: [], onSent: jest.fn() }), createElement(DialogLayer, { root: true })));
    expect(screen.getByTestId('composer-keyboard')).toBeTruthy();
    await fireEvent(screen.getByTestId('composer-input'), 'focus');
    expect(screen.queryByTestId('composer-keyboard')).toBeNull();
    expect(screen.getByTestId('composer-panel-toggle')).toBeTruthy();
  });
});
