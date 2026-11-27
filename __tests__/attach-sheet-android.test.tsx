import { createElement } from 'react';
import { BackHandler, Keyboard, Platform } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { AttachSheet } from '../src/features/chat/ui/composer/AttachSheet';
import '../src/i18n';

jest.mock('react-native-reanimated', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View },
    Easing: { bezier: () => (value: number) => value },
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
    withTiming: (value: unknown, _config?: unknown, done?: (finished: boolean) => void) => {
      done?.(true);
      return value;
    },
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args) }));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: jest.fn(), removeItemSync: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

let backHandlers: (() => boolean)[];

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler as () => boolean);
    return { remove: () => (backHandlers = backHandlers.filter((item) => item !== handler)) };
  });
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

const sheet = (visible: boolean, onClose = jest.fn()) => createElement(AttachSheet, { visible, onClose, onPick: jest.fn() });

describe('attach sheet on Android', () => {
  it('draws nothing until it is first opened', async () => {
    await render(sheet(false));
    expect(screen.queryByTestId('attach-layer')).toBeNull();
    expect(backHandlers).toHaveLength(0);
  });

  it('opens inside the screen, hides the keyboard, and closes on Back instead of leaving the chat', async () => {
    const onClose = jest.fn();
    await render(sheet(true, onClose));
    expect(screen.getByTestId('attach-layer').props.pointerEvents).toBe('auto');
    expect(screen.getByTestId('attach-photos')).toBeTruthy();
    expect(Keyboard.dismiss).toHaveBeenCalled();
    let handled = false;
    await act(async () => {
      handled = backHandlers[0]();
    });
    expect(handled).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('keeps one Back listener and one keyboard dismiss while the parent re-renders, and Back calls the latest onClose', async () => {
    const first = jest.fn();
    const latest = jest.fn();
    const view = await render(sheet(true, first));
    await view.rerender(sheet(true, jest.fn()));
    await view.rerender(sheet(true, latest));
    expect(BackHandler.addEventListener).toHaveBeenCalledTimes(1);
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
    await act(async () => {
      backHandlers[0]();
    });
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it('stays mounted after closing so the next open does not rebuild it, but takes no touches, Back or screen reader focus', async () => {
    const view = await render(sheet(true));
    await view.rerender(sheet(false));
    expect(screen.queryByTestId('attach-photos')).toBeNull();
    expect(screen.getByTestId('attach-photos', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('attach-layer', { includeHiddenElements: true }).props.pointerEvents).toBe('none');
    expect(backHandlers).toHaveLength(0);
  });
});
