jest.mock('react-native', () => ({ Platform: { OS: 'android' }, AppState: { currentState: 'active', addEventListener: () => ({ remove: () => undefined }) } }));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/features/call/native', () => ({ callNative: () => null, onCallAction: () => () => undefined }));

const mockDevice = { hardware: true, enrolled: false, level: 1 };
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => mockDevice.hardware,
  isEnrolledAsync: async () => mockDevice.enrolled,
  getEnrolledLevelAsync: async () => mockDevice.level,
  supportedAuthenticationTypesAsync: async () => [1],
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2 },
  SecurityLevel: { NONE: 0, SECRET: 1, BIOMETRIC_WEAK: 2, BIOMETRIC_STRONG: 3 },
}));

const { lockMethod } = require('../src/lock/lock') as typeof import('../src/lock/lock');

test('a phone with only a screen PIN still offers the app lock', async () => {
  Object.assign(mockDevice, { hardware: true, enrolled: false, level: 1 });
  await expect(lockMethod()).resolves.toBe('passcode');
});

test('a phone with no screen lock offers no app lock', async () => {
  Object.assign(mockDevice, { hardware: false, enrolled: false, level: 0 });
  await expect(lockMethod()).resolves.toBeNull();
});

test('an enrolled fingerprint is named as biometrics', async () => {
  Object.assign(mockDevice, { hardware: true, enrolled: true, level: 2 });
  await expect(lockMethod()).resolves.toBe('biometric');
});
