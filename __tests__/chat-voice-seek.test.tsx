const mockSeek = jest.fn();
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined } }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const animated = (component: unknown) => component;
  return { __esModule: true, default: { View, createAnimatedComponent: animated }, createAnimatedComponent: animated, isSharedValue: () => false, useComposedEventHandler: () => undefined };
});
jest.mock('../src/features/chat/ui/useCookie', () => ({ useCookie: () => null }));
jest.mock('../src/features/chat/voicePlayer', () => ({
  useVoice: () => ({ id: null, playing: false, position: 0, duration: 0, rate: 1, loading: false, meta: null }),
  usePlayed: () => true,
  toggleVoice: jest.fn(),
  seekVoice: jest.fn(),
  seekVoiceFraction: (...args: unknown[]) => mockSeek(...args),
  cycleVoiceRate: jest.fn(),
  closeVoice: jest.fn(),
}));
require('react-native-gesture-handler/jestSetup');
require('../src/i18n');
import { act, fireEvent, render, screen } from '@testing-library/react-native';
const { GestureHandlerRootView, State } = require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');
const { fireGestureHandler, getByGestureTestId } = require('react-native-gesture-handler/jest-utils') as typeof import('react-native-gesture-handler/jest-utils');
const { VoiceNote } = require('../src/features/chat/ui/VoiceNote') as typeof import('../src/features/chat/ui/VoiceNote');
type GestureState = (typeof State)[keyof typeof State];

const wave = 200;

async function note() {
  await render(
    <GestureHandlerRootView>
      <VoiceNote id="a7" uri="https://example.test/voice.m4a" mine={false} seed={7} durationMs={20000} />
    </GestureHandlerRootView>,
  );
  await fireEvent(screen.getByTestId('voice-wave-a7'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: wave, height: 32 } } });
}

async function dragWave(path: number[], end: GestureState = State.END) {
  const last = path[path.length - 1];
  await act(async () =>
    fireGestureHandler(getByGestureTestId('voice-wave-a7-drag'), [
      { state: State.BEGAN, x: path[0] },
      { state: State.ACTIVE, x: path[0] },
      ...path.slice(1).map((x) => ({ state: State.ACTIVE, x })),
      { state: end, x: last },
    ]),
  );
}

beforeEach(() => mockSeek.mockClear());

describe('voice note waveform inside a swipeable bubble', () => {
  it('seeks to where a horizontal drag lets go, with its own pan gesture instead of a JS responder the row swipe would cancel', async () => {
    await note();
    await dragWave([20, 90, 150]);
    expect(mockSeek).toHaveBeenCalledTimes(1);
    expect(mockSeek.mock.calls[0][0]).toBe('a7');
    expect(mockSeek.mock.calls[0][2]).toBeCloseTo(150 / wave);
  });

  it('clamps a drag that runs past either end of the waveform', async () => {
    await note();
    await dragWave([40, 260]);
    expect(mockSeek.mock.calls[0][2]).toBe(1);
    mockSeek.mockClear();
    await dragWave([40, -30]);
    expect(mockSeek.mock.calls[0][2]).toBe(0);
  });

  it('does not seek when the drag is cancelled, as when the list scrolls', async () => {
    await note();
    await dragWave([20, 90], State.CANCELLED);
    expect(mockSeek).not.toHaveBeenCalled();
  });

  it('seeks on a tap', async () => {
    await note();
    await act(async () => fireGestureHandler(getByGestureTestId('voice-wave-a7-tap'), [{ state: State.BEGAN, x: 50 }, { state: State.ACTIVE, x: 50 }, { state: State.END, x: 50 }]));
    expect(mockSeek).toHaveBeenCalledTimes(1);
    expect(mockSeek.mock.calls[0][2]).toBeCloseTo(50 / wave);
  });

});
