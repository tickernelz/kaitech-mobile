import { fireEvent, render, screen } from '@testing-library/react-native';
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

function layoutOf(target: number) {
  fireEvent(screen.getByTestId('refresh'), 'layout', { currentTarget: null, nativeEvent: { target, layout: { x: 0, y: 0, width: 360, height: 640 } } });
}

beforeEach(() => mockRelease.mockClear());

it('releases the hidden circle when a list re-clones the control with its own ref, as Animated.ScrollView in FlashList does', async () => {
  const element = <Refresh testID="refresh" refreshing={false} onRefresh={() => undefined} />;
  await render(cloneElement(element as ReactElement<{ ref?: unknown }>, { ref: createRef() }));
  layoutOf(42);
  expect(mockRelease).toHaveBeenCalledWith(42);
});

it('releases each mounted refresh layout once and still calls the caller onLayout', async () => {
  const caller = jest.fn();
  await render(<Refresh testID="refresh" refreshing={false} onRefresh={() => undefined} onLayout={caller} />);
  layoutOf(7);
  layoutOf(7);
  layoutOf(8);
  expect(mockRelease.mock.calls).toEqual([[7], [8]]);
  expect(caller).toHaveBeenCalledTimes(3);
});
