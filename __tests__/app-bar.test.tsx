import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
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
    withSpring: (value: unknown) => value,
  };
});
jest.mock('../src/features/activity/OdooActivities', () => ({ OdooActivities: ({ header }: { header: unknown }) => header }));
jest.mock('../src/features/activity/DiscoveryActivities', () => ({ DiscoveryActivities: ({ header }: { header: unknown }) => header }));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), navigate: jest.fn() }) }));
jest.mock('expo-linking', () => ({ openURL: jest.fn() }));
jest.mock('../src/auth/session', () => ({
  useSession: () => ({ active: { id: 'u1_a', name: 'Budi Santoso', partnerId: 3, origin: 'https://a.test' } }),
  accountKnown: () => true,
  onAccountForgotten: () => () => undefined,
}));
jest.mock('../src/api/resource', () => ({
  useResource: () => ({ data: null, loading: true, error: undefined, refresh: jest.fn() }),
  update: jest.fn(),
}));
jest.mock('../src/features/activity/useActivityOverview', () => ({ useActivityOverview: () => ({ data: null, loading: true, error: undefined, refresh: jest.fn() }) }));
jest.mock('../src/features/discovery/api', () => ({ briefing: jest.fn() }));

require('../src/i18n');
const i18n = require('../src/i18n').default as typeof import('../src/i18n').default;
const { ActivityScreen } = require('../src/features/activity/ActivityScreen') as typeof import('../src/features/activity/ActivityScreen');
const { TopAppBar, useScrolledUnder } = require('../src/ui/AppBar') as typeof import('../src/ui/AppBar');
const { Refresh } = require('../src/ui/Refresh') as typeof import('../src/ui/Refresh');

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };
const androidIndicatorDiameter = 40;

function style(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID, { includeHiddenElements: true }).props.style) ?? {};
}

describe('top app bar', () => {
  test('a tab screen has one title, and it sits in the bar row with Search and the profile avatar', async () => {
    await render(
      <SafeAreaProvider initialMetrics={{ frame, insets }}>
        <ActivityScreen />
      </SafeAreaProvider>,
    );
    const title = i18n.t('tabs.activity');
    const headers = screen.getAllByRole('header', { name: title });
    expect(headers).toHaveLength(1);

    const bar = screen.getByTestId('app-bar');
    expect(within(bar).getByRole('header')).toBe(headers[0]);
    expect(within(bar).getByTestId('open-search')).toBeTruthy();
    expect(within(bar).getByTestId('open-settings')).toBeTruthy();
    expect(style('app-bar')).toMatchObject({ flexDirection: 'row', alignItems: 'center', height: 64 });
    expect(style('app-bar').position).toBeUndefined();
    expect(style('app-bar-title').opacity ?? 1).toBe(1);
    expect(screen.getByTestId('app-bar-title').props.importantForAccessibility ?? 'auto').toBe('auto');
  });

  test('the bar tints once the list scrolls under it and clears again at the top, without re-rendering the screen', async () => {
    let screenRenders = 0;
    function Probe() {
      screenRenders += 1;
      const bar = useScrolledUnder();
      return (
        <>
          <TopAppBar title="Chat" scrolled={bar.scrolled} />
          <ScrollView testID="list" onScroll={bar.onScroll} />
        </>
      );
    }
    await render(<Probe />);
    const resting = style('app-bar').backgroundColor;
    const rendered = screenRenders;
    await fireEvent.scroll(screen.getByTestId('list'), { nativeEvent: { contentOffset: { x: 0, y: 1 } } });
    await fireEvent.scroll(screen.getByTestId('list'), { nativeEvent: { contentOffset: { x: 0, y: 40 } } });
    expect(style('app-bar').backgroundColor).not.toBe(resting);
    await fireEvent.scroll(screen.getByTestId('list'), { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(style('app-bar').backgroundColor).toBe(resting);
    expect(style('app-bar-title').opacity ?? 1).toBe(1);
    expect(screenRenders).toBe(rendered);
  });
});

describe('pull to refresh', () => {
  test('the Android indicator starts inside the list, so no pull depth shows a clipped circle', async () => {
    let drawn: { type: unknown; props: { progressViewOffset?: number } } | undefined;
    function Probe() {
      drawn = Refresh({ onRefresh: async () => undefined }) as typeof drawn;
      return null;
    }
    await render(<Probe />);
    expect(drawn?.type).toBe(RefreshControl);
    expect((drawn?.props.progressViewOffset ?? 0) - androidIndicatorDiameter).toBeGreaterThanOrEqual(0);
  });
});
