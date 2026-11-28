import { AccessibilityInfo, BackHandler, Platform } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '../src/i18n';

const mockAccount = { id: 'u2_cw', origin: 'https://odoo.test', db: 'lab0', userId: 2, partnerId: 3, deviceId: 4, name: 'T', login: 't', signedInAt: 0 };

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    Easing: chain(),
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
jest.mock('react-native-keyboard-controller', () => {
  const { View } = jest.requireActual('react-native');
  return { KeyboardAvoidingView: View, useKeyboardState: (select: (state: { isVisible: boolean; height: number }) => unknown) => select({ isVisible: false, height: 0 }) };
});
jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }, getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid' }));
jest.mock('expo-router', () => ({ useFocusEffect: () => undefined, useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../src/auth/session', () => ({ useSession: () => ({ active: mockAccount }), onAccountForgotten: () => () => undefined }));
jest.mock('../src/api/resource', () => ({ useResource: () => ({ data: null, loading: false, error: null, refresh: jest.fn() }), update: jest.fn() }));
jest.mock('../src/features/discovery/api', () => ({ ask: jest.fn(), cards: jest.fn(), panel: jest.fn(), transcript: jest.fn() }));
jest.mock('../src/features/discovery/store', () => ({
  flushDrafts: () => undefined,
  openConversation: jest.fn(),
  readDraft: () => '',
  useOpenConversation: () => null,
  writeDraft: jest.fn(),
}));
jest.mock('../src/features/discovery/viewing', () => ({ viewConversation: () => undefined }));
jest.mock('../src/features/chat/files', () => ({ localFile: jest.fn(), dropFile: jest.fn() }));
jest.mock('../src/features/chat/limits', () => ({ useUploadLimit: () => null }));
jest.mock('../src/features/chat/ui/useVoiceHold', () => ({ useVoiceHold: () => ({ recording: null }) }));
jest.mock('../src/features/chat/ui/MessageBubble', () => ({ Attachments: () => null }));
jest.mock('../src/features/discovery/DecisionCard', () => ({ DecisionCard: () => null }));
jest.mock('../src/features/discovery/Markdown', () => ({ Markdown: () => null }));
jest.mock('../src/features/chat/ui/MediaControls', () => ({ MicButton: () => null, RecordingStrip: () => null, StagedFile: () => null, UploadProgress: () => null }));

const { CoworkerThread } = require('../src/features/discovery/CoworkerThread') as typeof import('../src/features/discovery/CoworkerThread');

function visible(testID: string): boolean {
  let current: ReturnType<typeof screen.getByTestId> | null = screen.getByTestId(testID, { includeHiddenElements: true });
  while (current) {
    if (current.props.importantForAccessibility === 'no-hide-descendants') return false;
    current = current.parent;
  }
  return true;
}

afterEach(() => jest.restoreAllMocks());

describe('Coworker attach sheet on Android', () => {
  it('hides the input row while open, and Back returns TalkBack focus to the attach button once it is visible again', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const handlers: (() => boolean)[] = [];
    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
      handlers.push(handler as () => boolean);
      return { remove: () => handlers.splice(handlers.indexOf(handler as () => boolean), 1) };
    });
    const focusedWhileVisible: boolean[] = [];
    const focus = jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockImplementation(() => {
      focusedWhileVisible.push(visible('coworker-attach'));
    });
    await render(<CoworkerThread programme={40} />);
    await fireEvent.press(screen.getByTestId('coworker-attach'));
    expect(screen.getByTestId('attach-photos')).toBeTruthy();
    expect(visible('coworker-attach')).toBe(false);
    expect(visible('coworker-input')).toBe(false);
    await act(async () => {
      [...handlers].reverse().some((handler) => handler());
    });
    expect(focus).toHaveBeenCalledTimes(1);
    expect(focus).toHaveBeenCalledWith(expect.objectContaining({ props: expect.objectContaining({ testID: 'coworker-attach' }) }), 'focus');
    expect(focusedWhileVisible).toEqual([true]);
    expect(visible('coworker-input')).toBe(true);
  });
});
