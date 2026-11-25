import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type MockSheetProps = { children: unknown; onDismissRequest: () => void; ref?: unknown };

const mockEvents: string[] = [];
let mockFinishHide: () => void = () => undefined;

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
jest.mock('../src/ui/NativeSheet', () => jest.requireActual('../src/ui/NativeSheet.android'));
jest.mock('@expo/ui/jetpack-compose', () => {
  const React = require('react');
  const { Pressable, View } = require('react-native');
  function ModalBottomSheet({ children, onDismissRequest, ref }: MockSheetProps) {
    React.useImperativeHandle(ref, () => ({
      hide: () => {
        mockEvents.push('hide');
        return new Promise<void>((resolve) => {
          mockFinishHide = () => {
            mockEvents.push('hidden');
            resolve();
          };
        });
      },
    }));
    return (
      <View testID="bottom-sheet">
        <Pressable testID="bottom-sheet-dismiss" onPress={onDismissRequest} />
        {children}
      </View>
    );
  }
  const Pass = ({ children }: { children: unknown }) => <View>{children}</View>;
  return { Host: Pass, RNHostView: Pass, ModalBottomSheet };
});

require('../src/i18n');
const { ActionSheet } = require('../src/ui/ActionSheet') as typeof import('../src/ui/ActionSheet');
const { FormSheet } = require('../src/ui/FormSheet') as typeof import('../src/ui/FormSheet');

const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } };

function actions(onClose: () => void) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <ActionSheet
        title="Thread"
        onClose={onClose}
        actions={[
          { key: 'archive', icon: 'archive', label: 'Archive', onPress: () => mockEvents.push('archive') },
          { key: 'mute', icon: 'bell', label: 'Mute', choices: [{ key: 'mute-hour', icon: 'bell', label: 'One hour', onPress: () => mockEvents.push('mute-hour') }] },
        ]}
      />
    </SafeAreaProvider>
  );
}

beforeEach(() => {
  mockEvents.length = 0;
  mockFinishHide = () => undefined;
});

describe('Android sheets on the Material 3 bottom sheet', () => {
  test('an action waits for the sheet to slide away, then runs once and closes once', async () => {
    const onClose = jest.fn(() => mockEvents.push('close'));
    await render(actions(onClose));
    expect(screen.getByTestId('bottom-sheet')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('row-action-archive')));
    await act(async () => fireEvent.press(screen.getByTestId('row-action-archive')));
    expect(mockEvents).toEqual(['hide']);
    await act(async () => mockFinishHide());
    expect(mockEvents).toEqual(['hide', 'hidden', 'archive', 'close']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('swipe, scrim or back closes without running any action', async () => {
    const onClose = jest.fn();
    await render(actions(onClose));
    await act(async () => fireEvent.press(screen.getByTestId('bottom-sheet-dismiss')));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockEvents).toEqual([]);
  });

  test('a choice page opens inside the same sheet', async () => {
    const onClose = jest.fn();
    await render(actions(onClose));
    await act(async () => fireEvent.press(screen.getByTestId('row-action-mute')));
    expect(screen.getByTestId('row-action-mute-hour')).toBeTruthy();
    expect(mockEvents).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  test('a failed save keeps the form open with its error; a good save slides it away', async () => {
    const onClose = jest.fn();
    const onSubmit = jest.fn().mockResolvedValueOnce('Name taken').mockResolvedValueOnce(null);
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <FormSheet title="Rename" fields={[{ key: 'name', label: 'Name', initial: 'Ops' }]} submit="Save" onSubmit={onSubmit} onClose={onClose} testID="rename" />
      </SafeAreaProvider>,
    );
    await act(async () => fireEvent.press(screen.getByTestId('rename-submit')));
    expect(screen.getByTestId('rename-error')).toBeTruthy();
    expect(mockEvents).toEqual([]);
    await act(async () => fireEvent.press(screen.getByTestId('rename-submit')));
    expect(mockEvents).toEqual(['hide']);
    await act(async () => mockFinishHide());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
