import { createElement } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '../src/i18n';
import { EditorScreen } from '../src/features/mom/EditorScreen';
import type { EditorSegment, EditorView } from '../src/features/mom/editor';

const mockRowTexts: string[] = [];
let mockView: EditorView;

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    FadeIn: chain(),
    FadeInDown: chain(),
    Easing: chain(),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
  };
});
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: jest.fn(), removeItemSync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-keyboard-controller', () => ({ KeyboardAvoidingView: jest.requireActual('react-native').View }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }) }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('../src/api/resource', () => ({ invalidate: jest.fn(), useResource: () => ({ data: mockView, loading: false, error: null, refresh: jest.fn() }) }));
jest.mock('../src/auth/session', () => ({ useSession: () => ({ active: null }), onAccountForgotten: jest.fn(), getSession: () => ({ accounts: [], activeId: null }) }));
jest.mock('../src/features/mom/recorder', () => ({ clock: () => '', useRecorderClock: () => 0 }));
jest.mock('../src/features/mom/uploads', () => ({ discard: jest.fn(), dismiss: jest.fn(), retry: jest.fn() }));
jest.mock('../src/features/mom/playback', () => ({ usePlayback: () => ({}), PlayerBar: () => null }));
jest.mock('../src/ui/Text', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Text: ({ children, ...rest }: { children?: unknown }) => {
      if (typeof children === 'string' && children.startsWith('Kalimat ')) mockRowTexts.push(children);
      return jest.requireActual('react').createElement(Text, rest, children);
    },
  };
});

const segment = (id: number): EditorSegment => ({
  id,
  start: id * 4,
  clock: String(id),
  speaker: id % 2 ? 'S1' : 'S2',
  person: '',
  text: 'Kalimat ' + id + ' tentang harga dan stok gudang minggu ini',
  transcribedText: 'Kalimat ' + id,
  corrected: id % 13 === 0,
  speakerChanged: false,
  flagged: id % 17 === 0,
  altText: '',
  verdict: id % 11 === 0 ? 'divergent' : '',
  verdictLabel: '',
  reason: '',
  doubts: id % 19 === 0 ? [id] : [],
});

beforeEach(() => {
  mockRowTexts.length = 0;
  mockView = {
    recording: { id: 1, name: 'Rapat panjang' },
    segments: Array.from({ length: 1100 }, (_, index) => segment(index + 1)),
    speakers: [],
    doubts: [],
    people: [],
    history: [],
    hasElevenLabs: false,
    check: { state: '', label: '', note: '' },
    canChange: true,
    settled: '',
  };
});

it('typing in the search of an 1,100-line transcript re-renders no transcript line until the search settles', async () => {
  jest.useFakeTimers();
  await render(createElement(EditorScreen, { recording: 1 }));
  expect(screen.getByTestId('editor-segment-1')).toBeTruthy();
  const shown = mockRowTexts.length;
  expect(shown).toBeGreaterThan(0);
  mockRowTexts.length = 0;
  for (const typed of ['h', 'ha', 'har', 'harg', 'harga']) await fireEvent.changeText(screen.getByTestId('editor-search'), typed);
  expect(mockRowTexts).toHaveLength(0);
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
  expect(screen.getByTestId('editor-segment-1')).toBeTruthy();
  jest.useRealTimers();
}, 30_000);
