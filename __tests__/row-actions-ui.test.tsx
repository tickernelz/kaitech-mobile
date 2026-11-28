import { Pressable, Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockHaptic = jest.fn();
jest.mock('expo-haptics', () => ({ impactAsync: (...args: unknown[]) => mockHaptic(...args), ImpactFeedbackStyle: { Medium: 'medium' } }));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (component: unknown) => component },
  createAnimatedComponent: (component: unknown) => component,
  isSharedValue: () => false,
  useSharedValue: (value: unknown) => {
    const { useRef } = jest.requireActual('react');
    const ref = useRef(null);
    if (!ref.current) {
      let current = value;
      ref.current = { get: () => current, set: (next: unknown) => (current = next) };
    }
    return ref.current;
  },
}));
type MockTouch = { id: number; absoluteX: number; absoluteY: number };
type MockTouchEvent = { numberOfTouches: number; changedTouches: MockTouch[]; allTouches: MockTouch[] };
type MockGate = { onTouchesDown: (event: MockTouchEvent) => void; onTouchesMove: (event: MockTouchEvent) => void; onFinalize: () => void };
const mockGate: { current: MockGate | null } = { current: null };
jest.mock('react-native-gesture-handler', () => {
  const actual = jest.requireActual('react-native-gesture-handler');
  return {
    ...actual,
    usePanGesture: (config: MockGate & { manualActivation?: boolean }) => {
      if (config.manualActivation) mockGate.current = config;
      return actual.usePanGesture(config);
    },
  };
});
const mockReset = jest.fn();
const mockSwipeProps: { current: Record<string, unknown> } = { current: {} };
type MockSwipeableProps = {
  children: unknown;
  testID: string;
  onSwipeableOpenStartDrag?: () => void;
  renderLeftActions?: (...args: unknown[]) => unknown;
  renderRightActions?: (...args: unknown[]) => unknown;
  ref?: unknown;
};
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  const methods = { close: () => undefined, openLeft: () => undefined, openRight: () => undefined, reset: () => mockReset() };
  return {
    __esModule: true,
    default: function MockSwipeable(props: MockSwipeableProps) {
      const { children, testID, onSwipeableOpenStartDrag, renderLeftActions, renderRightActions, ref } = props;
      mockSwipeProps.current = props;
      React.useImperativeHandle(ref, () => methods);
      return React.createElement(
        View,
        null,
        React.createElement(Pressable, { testID: `${testID}-drag`, onPress: () => onSwipeableOpenStartDrag?.() }),
        renderLeftActions?.(null, null, methods),
        children,
        renderRightActions?.(null, null, methods),
      );
    },
  };
});

require('react-native-gesture-handler/jestSetup');
const { GestureHandlerRootView } = require('react-native-gesture-handler') as typeof import('react-native-gesture-handler');
require('../src/i18n');
const { RowActions } = require('../src/ui/RowActions') as typeof import('../src/ui/RowActions');
type SheetAction = import('../src/ui/ActionSheet').SheetAction;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function row(actions: SheetAction[], start: string[] = [], end?: string[], id = 4) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <GestureHandlerRootView>
      <RowActions title={`Room ${id}`} actions={actions} start={start} end={end} testID={`conversation-${id}`}>
        {(bind) => (
          <Pressable {...bind} testID="row" accessibilityLabel="Room 4">
            <Text>Room 4</Text>
          </Pressable>
        )}
      </RowActions>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

describe('row actions', () => {
  const archive = jest.fn();
  const mute = jest.fn();
  const actions: SheetAction[] = [
    { key: 'read', icon: 'checkDouble', label: 'Mark as read', short: 'Read', onPress: jest.fn() },
    { key: 'mute', icon: 'bellOff', label: 'Mute', choices: [{ key: 'mute-week', icon: 'bellOff', label: 'Mute for 1 week', onPress: mute }] },
    { key: 'archive', icon: 'archive', label: 'Archive', onPress: archive },
  ];

  beforeEach(() => {
    archive.mockClear();
    mute.mockClear();
    mockHaptic.mockClear();
  });

  it('opens the More sheet with a short buzz on long press, and runs the chosen action once', async () => {
    await render(row(actions));
    expect(screen.queryByTestId('row-sheet')).toBeNull();
    await act(async () => fireEvent(screen.getByTestId('row'), 'longPress'));
    expect(mockHaptic).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('row-sheet')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('row-action-archive')));
    expect(archive).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('row-sheet')).toBeNull();
  });

  it('opens a duration page for mute and runs the picked duration', async () => {
    await render(row(actions));
    await act(async () => fireEvent(screen.getByTestId('row'), 'longPress'));
    await act(async () => fireEvent.press(screen.getByTestId('row-action-mute')));
    expect(screen.queryByTestId('row-action-archive')).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId('row-action-mute-week')));
    expect(mute).toHaveBeenCalledTimes(1);
  });

  it('gives TalkBack every action of the sheet on the row itself', async () => {
    await render(row(actions));
    const target = screen.getByTestId('row');
    expect(target.props.accessibilityActions.map((action: { name: string }) => action.name)).toEqual(['longpress', 'read', 'mute', 'archive']);
    await act(async () => fireEvent(target, 'accessibilityAction', { nativeEvent: { actionName: 'archive' } }));
    expect(archive).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent(target, 'accessibilityAction', { nativeEvent: { actionName: 'mute' } }));
    expect(screen.getByTestId('row-action-mute-week')).toBeTruthy();
  });

  it('keeps the swipe panels out of the screen reader, which uses the row actions instead', async () => {
    await render(row(actions, ['read'], ['archive', 'more']));
    expect(screen.queryByLabelText('Archive')).toBeNull();
    expect(screen.getByTestId('conversation-4-swipe-end', { includeHiddenElements: true }).props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('draws no swipe buttons until a drag starts', async () => {
    await render(row(actions, ['read'], ['archive', 'more']));
    expect(screen.queryByTestId('conversation-4-swipe-archive', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('conversation-4-swipe-end', { includeHiddenElements: true })).toBeTruthy();
  });

  it('closes a half-open row and its sheet when the list reuses the cell for another conversation', async () => {
    const view = await render(row(actions, ['read'], ['archive', 'more']));
    await act(async () => fireEvent.press(screen.getByTestId('conversation-4-swipeable-drag', { includeHiddenElements: true })));
    await act(async () => fireEvent(screen.getByTestId('row'), 'longPress'));
    expect(screen.getByTestId('row-sheet')).toBeTruthy();
    mockReset.mockClear();
    await act(async () => view.rerender(row(actions, ['read'], ['archive', 'more'], 5)));
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('row-sheet')).toBeNull();
    expect(screen.queryByTestId('conversation-5-swipe-archive', { includeHiddenElements: true })).toBeNull();
  });

  it('shows the swipe actions it was given on each side, with More on the end side', async () => {
    await render(row(actions, ['read'], ['archive', 'more']));
    await act(async () => fireEvent.press(screen.getByTestId('conversation-4-swipeable-drag', { includeHiddenElements: true })));
    expect(screen.getByTestId('conversation-4-swipe-read', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('conversation-4-swipe-archive', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('conversation-4-swipe-mute')).toBeNull();
    await act(async () => fireEvent.press(screen.getByTestId('conversation-4-swipe-archive', { includeHiddenElements: true })));
    expect(archive).toHaveBeenCalledTimes(1);
    await act(async () => fireEvent.press(screen.getByTestId('conversation-4-swipe-more', { includeHiddenElements: true })));
    expect(screen.getByTestId('row-sheet')).toBeTruthy();
  });

  it('keeps the keyboard button out of touch until it has keyboard focus, then opens the sheet', async () => {
    await render(row(actions));
    const button = () => screen.getByTestId('conversation-4-more', { includeHiddenElements: true });
    await act(async () => fireEvent.press(button()));
    expect(screen.queryByTestId('row-sheet')).toBeNull();
    await act(async () => fireEvent(button(), 'focus'));
    await act(async () => fireEvent.press(button()));
    expect(screen.getByTestId('row-sheet')).toBeTruthy();
  });

  it('moves a row only after 28 dp sideways and opens it only after about 100 dp of finger travel', async () => {
    await render(row(actions, ['read'], ['archive', 'more']));
    const { dragOffsetFromLeft, dragOffsetFromRight, leftThreshold, rightThreshold, friction } = mockSwipeProps.current as Record<string, number>;
    expect(dragOffsetFromLeft).toBeGreaterThanOrEqual(28);
    expect(dragOffsetFromRight).toBeLessThanOrEqual(-28);
    expect(leftThreshold * friction).toBeGreaterThanOrEqual(100);
    expect(rightThreshold * friction).toBeGreaterThanOrEqual(100);
  });

  describe('a drag that starts as a scroll', () => {
    const touch = (id: number, absoluteX: number, absoluteY: number): MockTouch => ({ id, absoluteX, absoluteY });
    const down = (...touches: MockTouch[]) => mockGate.current!.onTouchesDown({ numberOfTouches: touches.length, changedTouches: [touches[touches.length - 1]], allTouches: touches });
    const move = (...touches: MockTouch[]) => mockGate.current!.onTouchesMove({ numberOfTouches: touches.length, changedTouches: touches, allTouches: touches });
    const swipeOn = () => (mockSwipeProps.current.enabled as { get: () => boolean }).get();

    beforeEach(async () => {
      mockGate.current = null;
      await render(row(actions, ['read'], ['archive', 'more']));
    });

    it('keeps the row closed for the rest of the touch once it moves 14 dp up or down first, and frees it after', () => {
      down(touch(0, 200, 400));
      move(touch(0, 205, 410));
      expect(swipeOn()).toBe(true);
      move(touch(0, 208, 414));
      expect(swipeOn()).toBe(false);
      move(touch(0, 300, 414));
      expect(swipeOn()).toBe(false);
      mockGate.current!.onFinalize();
      expect(swipeOn()).toBe(true);
    });

    it('leaves the swipe on when the drag goes 28 dp sideways first, even if it later drifts down', () => {
      down(touch(0, 200, 400));
      move(touch(0, 228, 405));
      move(touch(0, 260, 460));
      expect(swipeOn()).toBe(true);
    });

    it('judges the finger that started the drag, not a second finger', () => {
      down(touch(3, 200, 400));
      down(touch(3, 200, 400), touch(7, 500, 400));
      move(touch(7, 500, 480), touch(3, 230, 402));
      expect(swipeOn()).toBe(true);
    });
  });
});
