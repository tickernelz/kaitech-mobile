import { act, fireEvent, render, screen } from '@testing-library/react-native';
import '../src/i18n';

const mockDevice = { level: 0 };
const mockSignOut = jest.fn(async (_id: string) => 'revoked');
const mockAuthenticate = jest.fn(async (..._args: unknown[]) => ({ success: true }));
let mockDialogAnswer: { key: string; text: string } | null = { key: 'leave', text: '' };

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    FadeIn: chain(),
    Easing: chain(),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('react-native-keyboard-controller', () => ({ KeyboardAvoidingView: jest.requireActual('react-native').View }));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => '1', setItemSync: jest.fn(), removeItemSync: jest.fn() }));
jest.mock('expo-local-authentication', () => ({
  authenticateAsync: (...args: unknown[]) => mockAuthenticate(...args),
  getEnrolledLevelAsync: async () => mockDevice.level,
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
  AuthenticationType: {},
}));
jest.mock('../src/features/call/native', () => ({ callNative: () => null, onCallAction: () => () => undefined }));
jest.mock('../src/auth/session', () => ({
  getSession: () => ({ accounts: [{ id: 'u1_a' }, { id: 'u2_b' }], activeId: 'u1_a' }),
  signOut: (id: string) => mockSignOut(id),
}));
jest.mock('../src/ui/dialog', () => ({ openDialog: async () => mockDialogAnswer }));

const { LockScreen } = require('../src/lock/LockScreen') as typeof import('../src/lock/LockScreen');
const lock = require('../src/lock/lock') as typeof import('../src/lock/lock');

beforeEach(() => {
  mockSignOut.mockClear();
  mockAuthenticate.mockClear();
  mockDialogAnswer = { key: 'leave', text: '' };
});

it('offers signing out when the device no longer has a screen lock, and clears the lock after it', async () => {
  mockDevice.level = 0;
  await render(<LockScreen />);
  await screen.findByTestId('lock-no-screen-lock');
  expect(mockAuthenticate).not.toHaveBeenCalled();
  await act(async () => fireEvent.press(screen.getByTestId('lock-sign-out')));
  expect(mockSignOut.mock.calls.map(([id]) => id)).toEqual(['u1_a', 'u2_b']);
  expect(lock.lockEnabled()).toBe(false);
});

it('keeps the lock when the person cancels signing out', async () => {
  mockDevice.level = 0;
  mockDialogAnswer = null;
  await render(<LockScreen />);
  await act(async () => fireEvent.press(await screen.findByTestId('lock-sign-out')));
  expect(mockSignOut).not.toHaveBeenCalled();
});

it('asks for the device lock and offers no sign-out while the device is secured', async () => {
  mockDevice.level = 1;
  mockAuthenticate.mockImplementation(async () => ({ success: false }));
  await render(<LockScreen />);
  await screen.findByTestId('lock-unlock');
  expect(mockAuthenticate).toHaveBeenCalled();
  expect(screen.queryByTestId('lock-sign-out')).toBeNull();
});
