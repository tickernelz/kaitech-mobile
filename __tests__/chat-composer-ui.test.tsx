import { createElement } from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import '../src/i18n';

const mockSend = jest.fn(async () => 'key');
const mockStop = jest.fn();
const mockStartLocked = jest.fn();
let mockRecording: { started: number; elapsed: number; offset: number; lift: number; locked: boolean } | null = null;

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    Easing: chain(),
    interpolate: (value: number, input: number[], output: number[]) => output[0] + ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardController: { dismiss: jest.fn(async () => undefined) },
  useKeyboardState: (select: (state: { isVisible: boolean; height: number }) => unknown) => select({ isVisible: false, height: 0 }),
  useReanimatedKeyboardAnimation: () => ({ height: { get: () => 0 }, progress: { get: () => 0 } }),
}));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: jest.fn(), removeItemSync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: false })),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
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
jest.mock('../src/features/chat/ui/useVoiceHold', () => ({
  useVoiceHold: () => ({ recording: mockRecording, hold: {}, startLocked: mockStartLocked, stop: mockStop }),
}));
jest.mock('../src/features/chat/ui/composer/Panel', () => ({ ComposerPanel: () => null }));

const { Composer } = require('../src/features/chat/ui/Composer') as typeof import('../src/features/chat/ui/Composer');

const hidden = { includeHiddenElements: true };

async function show() {
  await render(createElement(Composer, { accountId: 'a', channelId: 12, messages: [], onSent: jest.fn() }));
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
  mockRecording = null;
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

  it('stages nothing and offers settings when the camera is refused', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await show();
    await fireEvent.press(screen.getByTestId('composer-camera'));
    expect(alert).toHaveBeenCalled();
    expect(visible('composer-mic')).toBe(true);
    alert.mockRestore();
  });

  it('turns the locked recording into cancel and send controls', async () => {
    mockRecording = { started: 0, elapsed: 4200, offset: 0, lift: 0, locked: true };
    await show();
    expect(screen.getByTestId('voice-recording-locked')).toBeTruthy();
    expect(visible('composer-send-voice')).toBe(true);
    await fireEvent.press(screen.getByTestId('voice-cancel'));
    expect(mockStop).toHaveBeenCalledWith(true);
    await fireEvent.press(screen.getByTestId('composer-send-voice'));
    expect(mockStop).toHaveBeenCalledWith(false);
  });

  it('switches the field button between the panel and the keyboard', async () => {
    await show();
    expect(screen.getByLabelText('Emoji, stickers and GIFs')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('composer-panel-toggle'));
    expect(screen.getByTestId('composer-keyboard')).toBeTruthy();
    expect(screen.getByLabelText('Show keyboard')).toBeTruthy();
  });
});
