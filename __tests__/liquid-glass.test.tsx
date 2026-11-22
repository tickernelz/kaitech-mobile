import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View },
    Easing: chain(),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ get: () => value, set: () => undefined }),
    useAnimatedStyle: (style: () => object) => style(),
    withTiming: (value: unknown) => value,
  };
});
jest.mock('react-native-keyboard-controller', () => require('react-native-keyboard-controller/jest'));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('react-native-screens/experimental', () => {
  const { createElement } = require('react');
  const { View } = require('react-native');
  return { FormSheet: (props: object) => createElement(View, { ...props, testID: 'native-sheet' }) };
});

require('../src/i18n');
const { Sheet } = require('../src/ui/Sheet') as typeof import('../src/ui/Sheet');
const { ActionSheet } = require('../src/ui/ActionSheet') as typeof import('../src/ui/ActionSheet');
const { FormSheet } = require('../src/ui/FormSheet') as typeof import('../src/ui/FormSheet');
const { badgeText } = require('../src/layout/tabs') as typeof import('../src/layout/tabs');

const glass = isLiquidGlassAvailable as jest.Mock;
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const framed = (node: React.ReactNode) => <SafeAreaProvider initialMetrics={metrics}>{node}</SafeAreaProvider>;
const nativeSheet = () => screen.getByTestId('native-sheet');

afterEach(() => glass.mockReturnValue(false));

describe('Activity tab badge', () => {
  it.each([
    [0, undefined],
    [-1, undefined],
    [7, '7'],
    [99, '99'],
    [100, '99+'],
  ])('%p pending shows %p', (count, text) => {
    expect(badgeText(count)).toBe(text);
  });
});

describe('sheets with Liquid Glass', () => {
  beforeEach(() => glass.mockReturnValue(true));

  it('presents Sheet as a native sheet sized to its content and closes after the dismissal finishes', async () => {
    const onClose = jest.fn();
    await render(framed(<Sheet title="Share" onClose={onClose} testID="share"><Text>Body</Text></Sheet>));
    expect(screen.queryByTestId('share-backdrop')).toBeNull();
    expect(nativeSheet().props).toMatchObject({ isOpen: true, detents: 'fitToContents', prefersGrabberVisible: true });
    await act(async () => fireEvent.press(screen.getByTestId('share-close')));
    expect(nativeSheet().props.isOpen).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => nativeSheet().props.onDismiss());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes at once when the person swipes the sheet away', async () => {
    const onClose = jest.fn();
    await render(framed(<Sheet title="Share" onClose={onClose}><Text>Body</Text></Sheet>));
    await act(async () => nativeSheet().props.onNativeDismiss());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('runs a chosen action only after the sheet is gone, so a follow-up sheet never stacks on a closing one', async () => {
    const order: string[] = [];
    await render(
      framed(
        <ActionSheet
          title="Room 4"
          actions={[{ key: 'rename', icon: 'edit', label: 'Rename', onPress: () => order.push('rename') }]}
          onClose={() => order.push('close')}
        />,
      ),
    );
    await act(async () => fireEvent.press(screen.getByTestId('row-action-rename')));
    expect(order).toEqual([]);
    expect(nativeSheet().props.isOpen).toBe(false);
    await act(async () => nativeSheet().props.onDismiss());
    expect(order).toEqual(['rename', 'close']);
  });

  it('opens a choice page inside the same native sheet without closing it', async () => {
    const onClose = jest.fn();
    await render(
      framed(
        <ActionSheet
          title="Room 4"
          actions={[{ key: 'mute', icon: 'bellOff', label: 'Mute', choices: [{ key: 'hour', icon: 'clock', label: '1 hour' }] }]}
          onClose={onClose}
        />,
      ),
    );
    await act(async () => fireEvent.press(screen.getByTestId('row-action-mute')));
    expect(screen.getByTestId('row-action-hour')).toBeTruthy();
    expect(nativeSheet().props.isOpen).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps FormSheet open with the error when saving fails, and closes it after a save', async () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn().mockResolvedValueOnce('Name is taken').mockResolvedValueOnce(null);
    await render(
      framed(<FormSheet title="Rename" fields={[{ key: 'name', label: 'Name', initial: 'Room' }]} submit="Save" onSubmit={onSubmit} onClose={onClose} testID="rename" />),
    );
    await act(async () => fireEvent.press(screen.getByTestId('rename-submit')));
    expect(screen.getByTestId('rename-error')).toHaveTextContent('Name is taken');
    expect(nativeSheet().props.isOpen).toBe(true);
    await act(async () => fireEvent.press(screen.getByTestId('rename-submit')));
    expect(nativeSheet().props.isOpen).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => nativeSheet().props.onDismiss());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('sheets without Liquid Glass', () => {
  it('keep the Kaitech sheet with its backdrop and close at once', async () => {
    const onClose = jest.fn();
    await render(framed(<Sheet title="Share" onClose={onClose} testID="share"><Text>Body</Text></Sheet>));
    expect(screen.queryByTestId('native-sheet')).toBeNull();
    expect(screen.getByTestId('share-backdrop')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('share-close')));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('run a chosen action at once', async () => {
    const run = jest.fn();
    const onClose = jest.fn();
    await render(framed(<ActionSheet title="Room 4" actions={[{ key: 'rename', icon: 'edit', label: 'Rename', onPress: run }]} onClose={onClose} />));
    await act(async () => fireEvent.press(screen.getByTestId('row-action-rename')));
    expect(run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
