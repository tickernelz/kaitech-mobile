import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

jest.mock('react-native-reanimated', () => {
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    Easing: chain(),
    useSharedValue: (value: unknown) => ({ value }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
  };
});

const { useAutoHide, hideAfterMs } = require('../src/features/call/ui/useAutoHide') as typeof import('../src/features/call/ui/useAutoHide');

let screenReader = false;
let recommended = hideAfterMs;

beforeEach(() => {
  jest.useFakeTimers();
  screenReader = false;
  recommended = hideAfterMs;
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockImplementation(() => Promise.resolve(screenReader));
  jest.spyOn(AccessibilityInfo, 'getRecommendedTimeoutMillis').mockImplementation(() => Promise.resolve(recommended));
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(() => ({ remove: () => undefined }) as never);
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function mount(pinned: boolean, wake = 'a') {
  const hook = await renderHook(({ pinned: hold, wake: key }: { pinned: boolean; wake: string }) => useAutoHide(hold, key), { initialProps: { pinned, wake } });
  await act(async () => {
    await Promise.resolve();
  });
  return hook;
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('call controls auto-hide', () => {
  it('hides the controls after the timeout and shows them again on a tap', async () => {
    const { result } = await mount(false);
    expect(result.current.shown).toBe(true);
    await advance(hideAfterMs - 1);
    expect(result.current.shown).toBe(true);
    await advance(1);
    expect(result.current.shown).toBe(false);
    await act(async () => result.current.toggle());
    expect(result.current.shown).toBe(true);
  });

  it('never hides while pinned', async () => {
    const { result } = await mount(true);
    await advance(hideAfterMs * 4);
    expect(result.current.shown).toBe(true);
  });

  it('never hides while a screen reader runs', async () => {
    screenReader = true;
    const { result } = await mount(false);
    await advance(hideAfterMs * 4);
    expect(result.current.shown).toBe(true);
    await act(async () => result.current.toggle());
    expect(result.current.shown).toBe(true);
  });

  it('follows the Android recommended timeout', async () => {
    recommended = 30_000;
    const { result } = await mount(false);
    await advance(hideAfterMs);
    expect(result.current.shown).toBe(true);
    await advance(30_000 - hideAfterMs);
    expect(result.current.shown).toBe(false);
  });

  it('shows the controls again when a call state changes', async () => {
    const { result, rerender } = await mount(false);
    await advance(hideAfterMs);
    expect(result.current.shown).toBe(false);
    await act(async () => rerender({ pinned: false, wake: 'b' }));
    expect(result.current.shown).toBe(true);
  });
});
