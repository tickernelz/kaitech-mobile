import { createElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import '../src/i18n';

const mockSend = jest.fn(async () => 'key');
const mockSendFeel = jest.fn();
jest.mock('../src/ui/haptic', () => ({ haptic: { send: () => mockSendFeel() } }));
const mockSendVoice = jest.fn();
const mockDiscard = jest.fn();
const mockStartLocked = jest.fn();
const mockKeyboard = { isVisible: false, height: 0 };
let mockVoiceState: { phase: string; locked?: boolean; reason?: string | null } = { phase: 'idle' };
let mockSeeThrough = true;
let mockInsetBottom = 0;

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
jest.mock('../src/ui/glass', () => ({ useSeeThrough: () => mockSeeThrough, useSurface: () => 'solid' }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardController: { dismiss: jest.fn(async () => undefined) },
  useKeyboardState: (select: (state: { isVisible: boolean; height: number }) => unknown) => select(mockKeyboard),
  useReanimatedKeyboardAnimation: () => ({ height: { get: () => 0 }, progress: { get: () => 0 } }),
}));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: jest.fn(), removeItemSync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: mockInsetBottom, left: 0, right: 0 }) }));
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
jest.mock('../src/features/chat/ui/composer/LocationPicker', () => ({ LocationPicker: () => null }));

const { Composer } = require('../src/features/chat/ui/Composer') as typeof import('../src/features/chat/ui/Composer');
const { DialogLayer } = require('../src/ui/Dialog') as typeof import('../src/ui/Dialog');
const { pill } = require('../src/ui/pill') as typeof import('../src/ui/pill');
const { measureRendered } = require('./fixtures/measure') as typeof import('./fixtures/measure');

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
  mockKeyboard.height = 0;
  mockSend.mockClear();
  mockSeeThrough = true;
  mockInsetBottom = 0;
  mockSendFeel.mockClear();
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

  it('keeps one pill-sized slot for mic and send so the row does not move', async () => {
    await show();
    const slot = screen.getByTestId('composer-send-slot', hidden);
    expect(StyleSheet.flatten(slot.props.style)).toMatchObject({ width: pill.composer.button, height: pill.composer.button });
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'halo');
    expect(StyleSheet.flatten(screen.getByTestId('composer-send-slot', hidden).props.style)).toMatchObject({ width: pill.composer.button, height: pill.composer.button });
  });

  it('sends the typed text and goes back to the microphone', async () => {
    await show();
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'halo');
    await fireEvent.press(screen.getByTestId('composer-send'));
    expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ channelId: 12, text: 'halo', files: [] }), expect.any(Number));
    expect(mockSendFeel).toHaveBeenCalledTimes(1);
    expect(visible('composer-mic')).toBe(true);
  });

  it('does not vibrate when send has nothing to send', async () => {
    await show();
    await fireEvent.changeText(screen.getByTestId('composer-input'), '   ');
    await fireEvent.press(screen.getByTestId('composer-send', hidden));
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockSendFeel).not.toHaveBeenCalled();
  });

  it('shows the format bar only while text is selected, like WhatsApp', async () => {
    mockKeyboard.isVisible = true;
    await show();
    const input = screen.getByTestId('composer-input');
    await fireEvent(input, 'focus');
    await fireEvent.changeText(input, 'halo dunia');
    await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: 10, end: 10 } } });
    expect(screen.queryByTestId('format-bar')).toBeNull();
    await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: 0, end: 4 } } });
    expect(screen.getByTestId('format-bar')).toBeTruthy();
    await fireEvent(input, 'selectionChange', { nativeEvent: { selection: { start: 10, end: 10 } } });
    expect(screen.queryByTestId('format-bar')).toBeNull();
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

  it('turns a locked recording into discard, pause and send-voice controls in the same pill-sized row', async () => {
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
    expect(StyleSheet.flatten(screen.getByTestId('composer-send-slot', hidden).props.style)).toMatchObject({ width: pill.composer.button, height: pill.composer.button });
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

  it('opens the panel as tall as the keyboard plus the format bar it replaces, so the row does not drop', async () => {
    mockKeyboard.isVisible = true;
    mockKeyboard.height = 320;
    await show();
    await fireEvent(screen.getByTestId('composer-input'), 'focus');
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'halo');
    await fireEvent(screen.getByTestId('composer-input'), 'selectionChange', { nativeEvent: { selection: { start: 0, end: 4 } } });
    const bar = screen.getByTestId('format-bar');
    await fireEvent(bar, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48.8 } } });
    await fireEvent.press(screen.getByTestId('composer-panel-toggle'));
    const box = screen.getByTestId('composer-panel-box', hidden);
    expect(StyleSheet.flatten(box.props.style).height).toBeCloseTo(320 + 48.8 + 4);
  });

  it('does not count a format bar that is no longer on screen when the panel opens', async () => {
    mockKeyboard.isVisible = true;
    mockKeyboard.height = 320;
    await show();
    await fireEvent(screen.getByTestId('composer-input'), 'focus');
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'halo');
    await fireEvent(screen.getByTestId('composer-input'), 'selectionChange', { nativeEvent: { selection: { start: 0, end: 4 } } });
    await fireEvent(screen.getByTestId('format-bar'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 48.8 } } });
    await fireEvent(screen.getByTestId('composer-input'), 'selectionChange', { nativeEvent: { selection: { start: 4, end: 4 } } });
    expect(screen.queryByTestId('format-bar')).toBeNull();
    await fireEvent.press(screen.getByTestId('composer-panel-toggle'));
    expect(StyleSheet.flatten(screen.getByTestId('composer-panel-box', hidden).props.style).height).toBe(320);
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

describe('composer capsule spacing', () => {
  const touch = 48;
  const element = () => createElement(Composer, { accountId: 'a', channelId: 12, messages: [], onSent: jest.fn() });
  const states = {
    empty: async () => undefined,
    typing: async () => fireEvent.changeText(screen.getByTestId('composer-input'), 'Uji kapsul kaca light'),
    panel: async () => fireEvent.press(screen.getByTestId('composer-panel-toggle')),
  };
  const cases = ([360, 411, 800] as const).flatMap((width) => [true, false].flatMap((seeThrough) => (Object.keys(states) as (keyof typeof states)[]).map((state) => [state, width, seeThrough] as const)));

  it.each(cases)('%s at %i dp (see-through %s): end icons sit as far from the capsule edge as attach, and clear of the send button', async (state, width, seeThrough) => {
    mockSeeThrough = seeThrough;
    await render(element());
    await states[state]();
    await screen.rerender(element());
    const box = measureRendered(screen.toJSON(), width);
    const capsule = box['composer-capsule'];
    const send = box['composer-send-slot'];
    const ids = ['composer-attach', state === 'panel' ? 'composer-keyboard' : 'composer-panel-toggle', ...(state === 'typing' ? [] : ['composer-camera'])];
    const icons = ids.map((id) => {
      const left = box[id].left + (box[id].width - pill.composer.icon) / 2;
      return { id, left, right: left + pill.composer.icon };
    });
    const lead = icons[0].left - capsule.left;
    const trail = capsule.left + capsule.width - icons[icons.length - 1].right;
    expect(lead).toBeGreaterThanOrEqual(12);
    expect(trail).toBe(lead);
    expect(send.left - icons[icons.length - 1].right).toBeGreaterThanOrEqual(lead + pill.composer.gap);
    for (let i = 1; i < icons.length; i++) expect([icons[i].id, icons[i].left - icons[i - 1].right >= lead]).toEqual([icons[i].id, true]);
    for (const id of ids) expect([id, Math.min(box[id].width, box[id].height) >= touch]).toEqual([id, true]);
    expect([send.top, send.height]).toEqual([capsule.top, capsule.height]);
  });
});

describe('floating composer', () => {
  const flat = (testID: string) => Object.assign({}, ...[screen.getByTestId(testID, hidden).props.style].flat(3).filter(Boolean));
  const within = (child: string, parent: string) => {
    let node: ReturnType<typeof screen.getByTestId> | null = screen.getByTestId(child, hidden);
    while (node && node.props.testID !== parent) node = node.parent;
    return node !== null;
  };

  it('has no solid bar behind it: only the glass capsule and the send button carry a surface', async () => {
    await show();
    expect(flat('composer').backgroundColor).toBeUndefined();
    expect(flat('composer').borderTopWidth).toBeUndefined();
    expect(screen.getByTestId('composer').props.pointerEvents).toBe('box-none');
    expect(flat('composer-capsule')).toMatchObject({ borderWidth: 1, boxShadow: expect.any(String) });
    expect(within('composer-input', 'composer-capsule')).toBe(true);
    expect(within('composer-attach', 'composer-capsule')).toBe(true);
    expect(within('composer-camera', 'composer-capsule')).toBe(true);
    expect(within('composer-send', 'composer-capsule') || within('composer-mic', 'composer-capsule')).toBe(false);
  });

  it('reports how far it floats over the list: gap, everything above the panel, and the bottom inset', async () => {
    const onOverlap = jest.fn();
    await render(createElement(Composer, { accountId: 'a', channelId: 12, messages: [], onSent: jest.fn(), onOverlap }));
    await fireEvent(screen.getByTestId('composer-float'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 60 } } });
    expect(onOverlap).toHaveBeenLastCalledWith(8 + 60 + 8);
    await fireEvent(screen.getByTestId('composer-float'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 104 } } });
    expect(onOverlap).toHaveBeenLastCalledWith(8 + 104 + 8);
  });

  it('keeps the overlap when the keyboard opens, so ThreadView does not re-render mid-animation', async () => {
    mockInsetBottom = 24;
    const onOverlap = jest.fn();
    const onSent = jest.fn();
    const composer = () => createElement(Composer, { accountId: 'a', channelId: 12, messages: [], onSent, onOverlap });
    await render(composer());
    await fireEvent(screen.getByTestId('composer-float'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 60 } } });
    expect(onOverlap).toHaveBeenLastCalledWith(8 + 60 + 24 + 8);
    mockKeyboard.isVisible = true;
    mockKeyboard.height = 300;
    await screen.rerender(composer());
    expect(Object.assign({}, ...[screen.getByTestId('composer').props.style].flat(3).filter(Boolean)).paddingBottom).toBe(8);
    expect(onOverlap).toHaveBeenCalledTimes(1);
  });

  it('turns solid with the same 1 dp edge when Reduce Transparency or high contrast is on', async () => {
    mockSeeThrough = false;
    await show();
    expect(screen.queryByTestId('glass-backdrop', hidden)).toBeNull();
    expect(flat('composer-capsule')).toMatchObject({ backgroundColor: expect.stringMatching(/^#[0-9A-F]{6}$/i), borderWidth: 1 });
  });

  it.each([true, false])('centres attach, emoji, camera and the text line on the send button (see-through %s)', async (seeThrough) => {
    mockSeeThrough = seeThrough;
    await show();
    const edge = flat('composer-capsule').borderWidth;
    const centre = flat('composer-send-slot').height / 2;
    expect(centre).toBe(pill.composer.button / 2);
    for (const id of ['composer-attach', 'composer-panel-toggle', 'composer-camera', 'composer-input']) {
      const box = flat(id);
      expect([id, edge + (box.height ?? box.minHeight) / 2]).toEqual([id, centre]);
    }
  });

  it.each([true, false])('puts the send button on the capsule layer: same shadow, or none when solid (see-through %s)', async (seeThrough) => {
    mockSeeThrough = seeThrough;
    await show();
    expect(flat('composer-send-slot').boxShadow).toBe(seeThrough ? flat('composer-capsule').boxShadow : undefined);
  });

  it('a recording row sits in the same glass capsule, so it stays readable over the chat', async () => {
    mockVoiceState = { phase: 'recording', locked: true };
    await show();
    expect(screen.getByTestId('composer-voice-capsule', hidden)).toBeTruthy();
  });
});
