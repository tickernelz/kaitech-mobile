import { render, screen, waitFor } from '@testing-library/react-native';
import type { Access } from '../src/auth/access';

require('../src/i18n');

const mockDevices = jest.fn(async () => [{ id: 4, type: 'computer', platform: 'Linux', browser: 'Firefox', ip: '10.0.0.1', place: '', last: '2026-11-28 08:00:00', current: false }]);
const mockAppDevices = jest.fn(async () => [{ id: 9, name: 'Mblu 21', platform: 'android', signedInAt: '2026-11-28 08:00:00', lastUsedAt: '2026-11-28 09:00:00', current: true }]);
const mockAccount: { id: string; origin: string; db: string; userId: number; partnerId: number; name: string; login: string; access?: Access } = { id: 'u7_x', origin: 'https://lab0.test', db: 'lab0', userId: 7, partnerId: 8, name: 'Klien', login: 'klien@example.com' };

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined } }));
jest.mock('expo-network', () => ({ useNetworkState: () => ({ isConnected: true, isInternetReachable: true }) }));
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }), useFocusEffect: (effect: () => void) => useEffect(effect, [effect]) };
});
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return { __esModule: true, default: { View }, Easing: chain(), useReducedMotion: () => true, useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }), useAnimatedStyle: (style: () => object) => style(), withTiming: (value: unknown) => value };
});
jest.mock('../src/auth/session', () => ({ useSession: () => ({ active: mockAccount }), onAccountForgotten: () => undefined, accountKnown: () => true, signOut: jest.fn(), markExpired: jest.fn() }));
jest.mock('../src/features/chat/ui/Avatar', () => ({ Avatar: () => null }));
jest.mock('../src/features/call/call', () => ({ pictureInPictureSupported: () => false }));
jest.mock('../src/features/call/pipSetting', () => ({ usePictureInPictureAllowed: () => false, setPictureInPictureAllowed: jest.fn() }));
jest.mock('../src/lock/lock', () => ({ useLock: () => ({ enabled: false, locked: false }), setLockEnabled: jest.fn() }));
jest.mock('../src/lock/useLockLabel', () => ({ useLockLabel: () => ({ method: null, label: '', ready: true }) }));
jest.mock('../src/features/account/odoo', () => ({ readMe: jest.fn(async () => ({ totpEnabled: false })) }));
jest.mock('../src/features/account/security', () => ({
  devices: () => mockDevices(),
  appDevices: () => mockAppDevices(),
  revokeAllDevices: jest.fn(),
  revokeAppDevice: jest.fn(),
  revokeDevice: jest.fn(),
  changePassword: jest.fn(),
  openPasswordChange: jest.fn(),
}));

const external: Access = { role: 'external', capabilities: ['client.home'] };
const internal: Access = { role: 'internal', capabilities: ['team'] };

const Settings = (require('../src/app/settings/index') as typeof import('../src/app/settings/index')).default;
const Security = (require('../src/app/settings/security') as typeof import('../src/app/settings/security')).default;
const Devices = (require('../src/app/settings/devices') as typeof import('../src/app/settings/devices')).default;
const Notifications = (require('../src/app/settings/notifications') as typeof import('../src/app/settings/notifications')).default;
const Password = (require('../src/app/settings/password') as typeof import('../src/app/settings/password')).default;

beforeEach(() => {
  mockDevices.mockClear();
  mockAppDevices.mockClear();
});

describe('Settings a client account can use', () => {
  it('leaves Notifications out of Settings for a client, where the server refuses every choice on it', async () => {
    mockAccount.access = external;
    await render(<Settings />);
    expect(screen.getByTestId('settings-account')).toBeTruthy();
    expect(screen.getByTestId('settings-security')).toBeTruthy();
    expect(screen.queryByTestId('settings-notifications')).toBeNull();
  });

  it('keeps Notifications for the team', async () => {
    mockAccount.access = internal;
    await render(<Settings />);
    expect(screen.getByTestId('settings-notifications')).toBeTruthy();
  });

  it('leaves the password change out of Security for a client and keeps two-step, passkeys and devices', async () => {
    mockAccount.access = external;
    await render(<Security />);
    expect(screen.queryByTestId('security-password')).toBeNull();
    expect(screen.queryByTestId('security-api-keys')).toBeNull();
    expect(screen.getByTestId('security-totp')).toBeTruthy();
    expect(screen.getByTestId('security-passkeys')).toBeTruthy();
    expect(screen.getByTestId('security-devices')).toBeTruthy();
  });

  it('keeps the password change for the team', async () => {
    mockAccount.access = internal;
    await render(<Security />);
    expect(screen.getByTestId('security-password')).toBeTruthy();
  });

  it('shows a client only the app devices and never asks for browser sessions', async () => {
    mockAccount.access = external;
    await render(<Devices />);
    await waitFor(() => expect(screen.getByTestId('app-device-9')).toBeTruthy());
    expect(mockDevices).not.toHaveBeenCalled();
    expect(screen.queryByTestId('device-4')).toBeNull();
    expect(screen.getByTestId('devices-revoke-all')).toBeTruthy();
  });

  it('shows the team app devices and browser sessions', async () => {
    mockAccount.access = internal;
    await render(<Devices />);
    await waitFor(() => expect(screen.getByTestId('device-4')).toBeTruthy());
    expect(screen.getByTestId('app-device-9')).toBeTruthy();
  });

  it('answers a client who opens Notifications or Password by link with the team-only page', async () => {
    mockAccount.access = external;
    await render(<Notifications />);
    expect(screen.getByTestId('gate-team-title')).toHaveTextContent('This page is for the Kaitech team.');
    expect(screen.queryByTestId('settings-notifications-screen')).toBeNull();
    await render(<Password />);
    expect(screen.getByTestId('gate-team-title')).toHaveTextContent('This page is for the Kaitech team.');
  });
});
