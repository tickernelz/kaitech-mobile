import type { ReactNode } from 'react';

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

function load(glass: boolean, reduceTransparency = false) {
  jest.resetModules();
  const rntl = require('@testing-library/react-native/pure') as typeof import('@testing-library/react-native/pure');
  const { AccessibilityInfo, Text } = require('react-native') as typeof import('react-native');
  (require('expo-glass-effect').isLiquidGlassAvailable as jest.Mock).mockReturnValue(glass);
  jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled').mockImplementation(async () => reduceTransparency);
  jest.spyOn(AccessibilityInfo, 'isDarkerSystemColorsEnabled').mockImplementation(async () => false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((() => ({ remove: () => undefined })) as typeof AccessibilityInfo.addEventListener);
  const bar = require('../src/ui/AppBar') as typeof import('../src/ui/AppBar');
  cleanup = rntl.cleanup;
  const actions: ReactNode = <Text testID="search">Search</Text>;
  return { ...rntl, ...bar, actions };
}

let cleanup: () => Promise<void> = async () => undefined;

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

describe('iOS app bar', () => {
  it('keeps the actions beside the large title and draws no bar where Liquid Glass is missing', async () => {
    const { render, TopAppBar, largeTitleOwnsActions, actions } = load(false);
    expect(largeTitleOwnsActions).toBe(true);
    const view = await render(<TopAppBar title="Chat" collapsed={false} actions={actions} />);
    expect(view.queryByTestId('app-bar')).toBeNull();
  });

  it('moves the actions into one glass group in the bar and hides the inline title until the large title scrolls away', async () => {
    const { render, act, within, TopAppBar, largeTitleOwnsActions, actions } = load(true);
    expect(largeTitleOwnsActions).toBe(false);
    const view = await render(<TopAppBar title="Chat" collapsed={false} actions={actions} />);
    await act(async () => undefined);
    expect(view.getByTestId('app-bar-actions').type).toBe('ExpoGlassView');
    expect(within(view.getByTestId('app-bar-actions')).getByTestId('search')).toBeTruthy();
    expect(view.getByTestId('app-bar-title', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
    await view.rerender(<TopAppBar title="Chat" collapsed actions={actions} />);
    expect(view.getByTestId('app-bar-title').props.accessibilityElementsHidden).toBe(false);
  });

  it('keeps the actions on plain surfaces when Reduce Transparency is on', async () => {
    const { render, act, TopAppBar, actions } = load(true, true);
    const view = await render(<TopAppBar title="Chat" collapsed actions={actions} />);
    await act(async () => undefined);
    expect(view.queryByTestId('app-bar-actions')).toBeNull();
    expect(view.getByTestId('search')).toBeTruthy();
  });

  it('collapses only after the large title has scrolled out of view', () => {
    const { renderHook, act, useCollapsingTitle } = load(true);
    return (async () => {
      const hook = await renderHook(() => useCollapsingTitle());
      const scroll = (y: number) => act(async () => hook.result.current.onScroll?.({ nativeEvent: { contentOffset: { x: 0, y } } } as never));
      await scroll(40);
      expect(hook.result.current.collapsed).toBe(false);
      await scroll(60);
      expect(hook.result.current.collapsed).toBe(true);
      await scroll(0);
      expect(hook.result.current.collapsed).toBe(false);
    })();
  });
});
