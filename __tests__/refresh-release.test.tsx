import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { cloneElement, createRef, type ReactElement } from 'react';
import { Refresh } from '../src/ui/Refresh';

const mockRelease = jest.fn(async (_tag: number) => undefined);
jest.mock('expo', () => ({ requireOptionalNativeModule: () => ({ releaseIndicatorTouches: (tag: number) => mockRelease(tag) }) }));
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => {
  const { View } = jest.requireActual('react-native');
  const Control = (props: object) => <View {...props} />;
  return { __esModule: true, default: Control };
});
jest.mock('../src/theme', () => ({ useTheme: () => ({ colors: { primary: '#5b2a86' } }) }));

async function layoutOf(target: number, element = screen.getByTestId('refresh')) {
  await fireEvent(element, 'layout', { currentTarget: null, nativeEvent: { target, layout: { x: 0, y: 0, width: 360, height: 640 } } });
}

beforeEach(() => mockRelease.mockClear());

it('releases the hidden circle when a list re-clones the control with its own ref, as Animated.ScrollView in FlashList does', async () => {
  const element = <Refresh testID="refresh" onRefresh={async () => undefined} />;
  await render(cloneElement(element as ReactElement<{ ref?: unknown }>, { ref: createRef() }));
  await layoutOf(42);
  expect(mockRelease).toHaveBeenCalledWith(42);
});

it('releases each mounted refresh layout once and still calls the caller onLayout', async () => {
  const caller = jest.fn();
  await render(<Refresh testID="refresh" onRefresh={async () => undefined} onLayout={caller} />);
  await layoutOf(7);
  await layoutOf(7);
  await layoutOf(8);
  expect(mockRelease.mock.calls).toEqual([[7], [8]]);
  expect(caller).toHaveBeenCalledTimes(3);
});

it('retries on the next frames while the native layout is not mounted yet, then gives up so a later layout can try again', async () => {
  const frames: FrameRequestCallback[] = [];
  const settle = async () => {
    for (let round = 0; round < 40; round += 1) {
      await Promise.resolve();
      frames.splice(0).forEach((callback) => callback(0));
    }
  };
  const view = await render(<Refresh testID="refresh" onRefresh={async () => undefined} />);
  const control = view.getByTestId('refresh');
  const raf = jest.spyOn(global, 'requestAnimationFrame').mockImplementation((callback) => frames.push(callback));
  try {
    mockRelease.mockRejectedValueOnce(new Error('view not found')).mockRejectedValueOnce(new Error('view not found'));
    await layoutOf(5, control);
    await settle();
    expect(mockRelease.mock.calls).toEqual([[5], [5], [5]]);

    mockRelease.mockClear().mockRejectedValue(new Error('view not found'));
    await layoutOf(6, control);
    await settle();
    expect(mockRelease).toHaveBeenCalledTimes(11);

    mockRelease.mockClear().mockImplementation(async () => undefined);
    await layoutOf(6, control);
    expect(mockRelease).toHaveBeenCalledWith(6);
  } finally {
    raf.mockRestore();
  }
});

it('shows the indicator only from a pull until the refresh it started settles, also when that refresh fails', async () => {
  let fail: (error: Error) => void = () => undefined;
  const onRefresh = jest.fn(() => new Promise<void>((_resolve, reject) => (fail = reject)));
  await render(<Refresh testID="refresh" onRefresh={onRefresh} />);
  const shown = () => screen.getByTestId('refresh').props.refreshing;
  expect(shown()).toBe(false);
  await fireEvent(screen.getByTestId('refresh'), 'refresh');
  expect(onRefresh).toHaveBeenCalledTimes(1);
  expect(shown()).toBe(true);
  await act(async () => fail(new Error('boom')));
  expect(shown()).toBe(false);
});
