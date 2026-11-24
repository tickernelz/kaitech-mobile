import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

type MockModifier = { testID?: string; description?: string };

const mockSwitch = jest.fn();
let mockFocused = 'index';
let mockPending = 0;
let mockWindow: 'compact' | 'medium' | 'expanded' = 'compact';

jest.mock('expo-router/ui', () => {
  const { View } = require('react-native');
  return {
    Tabs: ({ children, style }: { children: unknown; style: unknown }) => <View style={style}>{children}</View>,
    TabList: () => null,
    TabTrigger: () => null,
    TabSlot: () => <View testID="tab-slot" />,
    useTabTrigger: ({ name }: { name: string }) => ({ trigger: { isFocused: name === mockFocused }, switchTab: mockSwitch }),
  };
});

jest.mock('@expo/ui/jetpack-compose/modifiers', () => ({
  testID: (tag: string) => ({ testID: tag }),
  semantics: (config: { contentDescription?: string }) => ({ description: config.contentDescription }),
}));

jest.mock('@expo/ui/jetpack-compose', () => {
  const { Pressable, Text, View } = require('react-native');
  const tagOf = (modifiers?: MockModifier[]) => modifiers?.find((m) => m.testID)?.testID;
  const describedBy = (modifiers?: MockModifier[]) => modifiers?.find((m) => m.description)?.description;
  const Slot = ({ children }: { children: unknown }) => <View>{children}</View>;
  const NavigationBarItem = ({ children, selected, onClick, modifiers }: { children: unknown; selected: boolean; onClick: () => void; modifiers?: MockModifier[] }) => (
    <Pressable testID={tagOf(modifiers)} accessibilityState={{ selected }} onPress={onClick}>
      {children}
    </Pressable>
  );
  NavigationBarItem.Icon = Slot;
  NavigationBarItem.Label = Slot;
  const BadgedBox = Slot as typeof Slot & { Badge: typeof Slot };
  BadgedBox.Badge = Slot;
  return {
    Host: ({ children }: { children: unknown }) => <View testID="material-host">{children}</View>,
    NavigationBar: ({ children }: { children: unknown }) => <View testID="navigation-bar">{children}</View>,
    NavigationBarItem,
    BadgedBox,
    Badge: ({ children, modifiers }: { children: unknown; modifiers?: MockModifier[] }) => (
      <View testID={tagOf(modifiers)} accessibilityLabel={describedBy(modifiers)}>
        {children}
      </View>
    ),
    RNHostView: Slot,
    Text: ({ children }: { children: unknown }) => <Text>{children}</Text>,
  };
});

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/features/activity/useActivityOverview', () => ({ usePendingActivities: () => mockPending }));
jest.mock('../src/layout/windowClass', () => ({ useWindowClass: () => ({ windowClass: mockWindow }) }));

require('../src/i18n');
const { MaterialTabs } = require('../src/layout/MaterialTabs') as typeof import('../src/layout/MaterialTabs');

async function show() {
  await render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } }}>
      <MaterialTabs />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  mockSwitch.mockClear();
  mockFocused = 'index';
  mockPending = 0;
  mockWindow = 'compact';
});

describe('Android Material 3 tabs', () => {
  test('a phone gets the navigation bar with the current tab selected', async () => {
    await show();
    expect(screen.getByTestId('navigation-bar')).toBeTruthy();
    expect(screen.getByTestId('tab-button-chat').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('tab-button-mom').props.accessibilityState.selected).toBe(false);
  });

  test('tapping another tab switches to its route; tapping the current tab does not navigate again', async () => {
    await show();
    await act(async () => fireEvent.press(screen.getByTestId('tab-button-mom')));
    expect(mockSwitch).toHaveBeenCalledWith('mom', {});
    mockSwitch.mockClear();
    await act(async () => fireEvent.press(screen.getByTestId('tab-button-chat')));
    expect(mockSwitch).not.toHaveBeenCalled();
  });

  test('no pending activity shows no badge', async () => {
    await show();
    expect(screen.queryByTestId('tab-badge-activity')).toBeNull();
  });

  test('pending activities show a badge capped at 99+ with a spoken count', async () => {
    mockPending = 150;
    await show();
    const badge = screen.getByTestId('tab-badge-activity');
    expect(screen.getByText('99+')).toBeTruthy();
    expect(badge.props.accessibilityLabel).toMatch(/150/);
  });

  test.each(['medium', 'expanded'] as const)('a %s window gets the rail instead of the bar, and the rail switches tabs', async (windowClass) => {
    mockWindow = windowClass;
    mockFocused = 'activity';
    mockPending = 3;
    await show();
    expect(screen.queryByTestId('navigation-bar')).toBeNull();
    expect(screen.getByTestId('tab-button-activity').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('tab-badge-activity')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('tab-button-discovery')));
    expect(mockSwitch).toHaveBeenCalledWith('discovery', {});
  });
});
