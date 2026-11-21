const mockAppListeners: ((state: string) => void)[] = [];
let mockPip = false;

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    currentState: 'active',
    addEventListener: (_type: string, listener: (state: string) => void) => {
      mockAppListeners.push(listener);
      return { remove: () => undefined };
    },
  },
}));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => '1', setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('expo-local-authentication', () => ({ authenticateAsync: async () => ({ success: true }), AuthenticationType: {} }));
const mockCallActions: ((action: { type: string; active?: boolean }) => void)[] = [];
let mockResumed = true;
jest.mock('../src/features/call/native', () => ({
  callNative: () => ({ isInPictureInPicture: () => mockPip, isResumed: () => mockResumed }),
  onCallAction: (listener: (action: { type: string; active?: boolean }) => void) => {
    mockCallActions.push(listener);
    return () => undefined;
  },
}));

const minute = 60 * 1000;
let now = 0;
let locks = 0;

function pipEnded(resumed: boolean) {
  mockPip = false;
  mockResumed = resumed;
  mockCallActions.forEach((listener) => listener({ type: 'pip', active: false }));
}

function emit(at: number, state: string, pip: boolean) {
  now = at;
  mockPip = pip;
  mockAppListeners.forEach((listener) => listener(state));
}

describe('app lock while a call sits in picture-in-picture', () => {
  beforeEach(async () => {
    jest.resetModules();
    mockAppListeners.length = 0;
    mockCallActions.length = 0;
    mockPip = false;
    mockResumed = true;
    now = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const lock = require('../src/lock/lock');
    await lock.unlock('prompt', 'cancel');
    locks = 0;
    lock.onLockChange(() => {
      locks += 1;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('counts the time spent in picture-in-picture toward the lock', () => {
    emit(0, 'background', false);
    emit(50, 'active', true);
    emit(10 * minute, 'background', true);
    emit(10 * minute + 50, 'active', false);
    expect(locks).toBe(1);
  });

  it('locks when the picture-in-picture window is expanded after the timeout', () => {
    emit(0, 'background', false);
    emit(50, 'active', true);
    emit(6 * minute, 'active', false);
    expect(locks).toBe(1);
  });

  it('locks when the window is expanded and the resume arrived before the mode change', () => {
    emit(0, 'background', false);
    emit(50, 'active', true);
    emit(6 * minute, 'active', true);
    expect(locks).toBe(0);
    pipEnded(true);
    expect(locks).toBe(1);
  });

  it('keeps counting when the window is dismissed instead of expanded', () => {
    emit(0, 'background', false);
    emit(50, 'active', true);
    now = 3 * minute;
    pipEnded(false);
    emit(3 * minute + 10, 'background', false);
    emit(6 * minute, 'active', false);
    expect(locks).toBe(1);
  });

  it('does not lock after a short trip to picture-in-picture', () => {
    emit(0, 'background', false);
    emit(50, 'active', true);
    emit(2 * minute, 'active', false);
    expect(locks).toBe(0);
  });
});
