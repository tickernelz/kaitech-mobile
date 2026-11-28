import { createElement, createRef, useState, type ComponentRef, type RefObject } from 'react';
import { AccessibilityInfo, BackHandler, Dimensions, Keyboard, Platform, StyleSheet, View } from 'react-native';
import { act, render, screen, within } from '@testing-library/react-native';
import { AttachSheet } from '../src/features/chat/ui/composer/AttachSheet';
import { Behind } from '../src/ui/cover';
import { space } from '../src/theme';
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
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }) }));

let backHandlers: (() => boolean)[];

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'android');
  backHandlers = [];
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    backHandlers.push(handler as () => boolean);
    return { remove: () => (backHandlers = backHandlers.filter((item) => item !== handler)) };
  });
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
  jest.spyOn(AccessibilityInfo, 'sendAccessibilityEvent').mockClear().mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

const sheet = (visible: boolean, onClose = jest.fn()) => createElement(AttachSheet, { visible, onClose, onPick: jest.fn() });

type Anchor = RefObject<ComponentRef<typeof View> | null>;

function Thread({ anchor, returnFocus, startOpen = true }: { anchor: Anchor; returnFocus?: Anchor; startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <View>
      <Behind testID="behind">
        <View ref={anchor} accessible testID="anchor" />
      </Behind>
      <AttachSheet visible={open} onClose={() => setOpen(false)} onPick={jest.fn()} returnFocus={returnFocus} />
    </View>
  );
}

const behindHidden = () => screen.getByTestId('behind', { includeHiddenElements: true }).props.importantForAccessibility;

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

  it('hides the conversation behind from TalkBack while open, then shows it again and puts focus back on the attach button after Back', async () => {
    const anchor: Anchor = createRef();
    await render(<Thread anchor={anchor} returnFocus={anchor} />);
    expect(behindHidden()).toBe('no-hide-descendants');
    expect(screen.queryByTestId('anchor')).toBeNull();
    expect(AccessibilityInfo.sendAccessibilityEvent).not.toHaveBeenCalled();
    await act(async () => {
      backHandlers[0]();
    });
    expect(behindHidden()).toBe('auto');
    expect(screen.getByTestId('anchor')).toBeTruthy();
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledTimes(1);
    expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledWith(anchor.current, 'focus');
    expect(anchor.current).toBeTruthy();
  });

  it('moves no focus while it has never been open', async () => {
    const anchor: Anchor = createRef();
    await render(<Thread anchor={anchor} returnFocus={anchor} startOpen={false} />);
    expect(behindHidden()).toBe('auto');
    expect(AccessibilityInfo.sendAccessibilityEvent).not.toHaveBeenCalled();
  });

  it('uncovers the screen on Back even without an attach button to return to', async () => {
    await render(<Thread anchor={createRef()} />);
    expect(behindHidden()).toBe('no-hide-descendants');
    await act(async () => {
      backHandlers[0]();
    });
    expect(behindHidden()).toBe('auto');
    expect(AccessibilityInfo.sendAccessibilityEvent).not.toHaveBeenCalled();
  });

  it('uncovers the screen when the conversation is left with the sheet still open', async () => {
    const view = await render(createElement(View, null, createElement(Behind, { testID: 'behind' }), sheet(true)));
    expect(behindHidden()).toBe('no-hide-descendants');
    await view.rerender(createElement(View, null, createElement(Behind, { testID: 'behind' })));
    expect(behindHidden()).toBe('auto');
  });

  it('caps the sheet below the status bar and lets the sources scroll when the window is short, as in landscape', async () => {
    await render(sheet(true));
    const { height } = Dimensions.get('window');
    expect(StyleSheet.flatten(screen.getByTestId('attach-sheet').props.style).maxHeight).toBe(height - 24 - space.xl);
    const scroll = screen.getByTestId('attach-scroll');
    for (const source of ['photos', 'camera', 'files', 'audio']) expect(within(scroll).getByTestId(`attach-${source}`)).toBeTruthy();
  });
});

describe('attach sheet on iOS', () => {
  it('leaves the screen behind alone because the native modal already isolates it', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(createElement(View, null, createElement(Behind, { testID: 'behind' }), sheet(true)));
    expect(behindHidden()).toBe('auto');
  });
});
