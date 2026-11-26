import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockSwitch = jest.fn();
const mockSpring = jest.fn((value: unknown) => value);
const mockSelection = jest.fn(async () => undefined);
let mockFocused = 'index';
let mockPending = 0;
let mockWindow: 'compact' | 'medium' | 'expanded' = 'compact';
let mockKeyboard = false;
let mockReduceMotion = false;
let mockSeeThrough = true;

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View, Text: require('react-native').Text },
    Easing: chain(),
    useSharedValue: (initial: unknown) => {
      const kept = require('react').useRef(null);
      if (!kept.current) {
        let value = initial;
        kept.current = { get: () => value, set: (next: unknown) => (value = next) };
      }
      return kept.current;
    },
    useAnimatedStyle: (style: () => object) => style(),
    withSpring: (value: unknown) => mockSpring(value),
    withTiming: (value: unknown) => value,
    interpolateColor: (_: number, __: number[], colors: string[]) => colors[1],
  };
});
jest.mock('expo-router/ui', () => {
  const { View, Text: Words } = require('react-native');
  const { useTabBarSpace: useSpace } = require('../src/layout/tabBar');
  function Probe() {
    return <Words testID="tab-space">{String(useSpace())}</Words>;
  }
  return {
    Tabs: ({ children, style }: { children: unknown; style: unknown }) => <View style={style}>{children}</View>,
    TabList: () => null,
    TabTrigger: () => null,
    TabSlot: () => <Probe />,
    defaultTabsSlotRender: () => null,
    useTabTrigger: ({ name }: { name: string }) => ({ trigger: { isFocused: name === mockFocused }, switchTab: mockSwitch }),
  };
});
jest.mock('expo-haptics', () => ({ selectionAsync: () => mockSelection(), performAndroidHapticsAsync: async () => undefined, AndroidHaptics: { Virtual_Key: 'virtual-key' } }));
jest.mock('react-native-keyboard-controller', () => ({ useKeyboardState: (pick: (state: { isVisible: boolean; height: number }) => unknown) => pick({ isVisible: mockKeyboard, height: 0 }) }));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/features/activity/useActivityOverview', () => ({ usePendingActivities: () => mockPending }));
jest.mock('../src/layout/windowClass', () => ({ useWindowClass: () => ({ windowClass: mockWindow }) }));
jest.mock('../src/theme/reduceMotion', () => ({ useReduceMotion: () => mockReduceMotion }));
jest.mock('../src/ui/glass', () => ({ useSeeThrough: () => mockSeeThrough }));

require('../src/i18n');
const { PillTabs } = require('../src/layout/PillTabs') as typeof import('../src/layout/PillTabs');
const { PillBar: MaterialPill } = require('../src/layout/PillBar.android') as typeof import('../src/layout/PillBar.android');
const { glyphLeft, labelRoom, openness, pillCover, pillPadding, pillSlots, pillWidth, slotLeft, useTabBarSpace } = require('../src/layout/tabBar') as typeof import('../src/layout/tabBar');

const metrics = { frame: { x: 0, y: 0, width: 411, height: 914 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } };
const hidden = { includeHiddenElements: true };

function tree() {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <PillTabs />
    </SafeAreaProvider>
  );
}

const selected = (name: string) => screen.getByTestId(`tab-button-${name}`).props.accessibilityState.selected;

beforeEach(() => {
  mockSwitch.mockClear();
  mockSpring.mockClear();
  mockSelection.mockClear();
  mockFocused = 'index';
  mockPending = 0;
  mockWindow = 'compact';
  mockKeyboard = false;
  mockReduceMotion = false;
  mockSeeThrough = true;
});

const flat = (testID: string) => Object.assign({}, ...[screen.getByTestId(testID, hidden).props.style].flat(3).filter(Boolean));

describe('floating pill tab bar (shared behaviour, iOS below 26 look)', () => {
  test('a phone gets the floating pill with the current tab selected and its label on one line', async () => {
    await render(tree());
    expect(screen.getByTestId('navigation-bar')).toBeTruthy();
    expect(screen.queryByTestId('navigation-rail')).toBeNull();
    expect(selected('chat')).toBe(true);
    expect(selected('mom')).toBe(false);
    expect(screen.getByTestId('tab-label-chat', hidden).props.numberOfLines).toBe(1);
  });

  test('tapping another tab switches to its route with a light haptic; tapping the current tab does neither', async () => {
    await render(tree());
    await act(async () => fireEvent.press(screen.getByTestId('tab-button-mom')));
    expect(mockSwitch).toHaveBeenCalledWith('mom', {});
    expect(mockSelection).toHaveBeenCalledTimes(1);
    mockSwitch.mockClear();
    mockSelection.mockClear();
    await act(async () => fireEvent.press(screen.getByTestId('tab-button-chat')));
    expect(mockSwitch).not.toHaveBeenCalled();
    expect(mockSelection).not.toHaveBeenCalled();
  });

  test('iOS gives every tab an equal slot with its label under the icon, like the system bar', async () => {
    mockFocused = 'mom';
    await render(tree());
    const widths = ['chat', 'discovery', 'mom', 'activity'].map((name) => flat(`tab-button-${name}`).width);
    expect(new Set(widths).size).toBe(1);
    for (const name of ['chat', 'discovery', 'mom', 'activity']) expect(screen.getByTestId(`tab-label-${name}`, hidden)).toBeTruthy();
  });

  test('the capsule is slightly see-through, and solid when Reduce Transparency or Increase Contrast is on', async () => {
    const view = await render(tree());
    expect(flat('navigation-bar').backgroundColor).toMatch(/^#[0-9A-F]{6}D1$/i);
    mockSeeThrough = false;
    await act(async () => view.rerender(tree()));
    expect(flat('navigation-bar').backgroundColor).toMatch(/^#[0-9A-F]{6}$/i);
  });

  test('the highlight springs to a newly selected tab', async () => {
    const view = await render(tree());
    mockSpring.mockClear();
    mockFocused = 'activity';
    await act(async () => view.rerender(tree()));
    expect(selected('activity')).toBe(true);
    expect(mockSpring).toHaveBeenCalledWith(3);
  });

  test('with Reduce Motion the highlight jumps and a press does not squeeze', async () => {
    mockReduceMotion = true;
    const view = await render(tree());
    mockFocused = 'discovery';
    await act(async () => view.rerender(tree()));
    expect(selected('discovery')).toBe(true);
    await act(async () => fireEvent(screen.getByTestId('tab-button-mom'), 'pressIn'));
    expect(mockSpring).not.toHaveBeenCalled();
  });

  test('a route that is not one of the tabs selects no tab and hides the highlight', async () => {
    mockFocused = 'settings';
    await render(tree());
    for (const name of ['chat', 'discovery', 'mom', 'activity']) expect(selected(name)).toBe(false);
    expect(screen.getByTestId('tab-highlight', hidden).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ opacity: 0 })]));
  });

  test('no pending activity shows no badge and says no count', async () => {
    await render(tree());
    expect(screen.queryByTestId('tab-badge-activity', hidden)).toBeNull();
    expect(screen.getByTestId('tab-button-activity').props.accessibilityLabel).not.toMatch(/\d/);
  });

  test('pending activities show a badge capped at 99+ and the tab speaks the full count', async () => {
    mockPending = 150;
    await render(tree());
    expect(screen.getByTestId('tab-badge-activity', hidden)).toBeTruthy();
    expect(screen.getByText('99+', hidden)).toBeTruthy();
    expect(screen.getByTestId('tab-button-activity').props.accessibilityLabel).toMatch(/150/);
  });

  test('while the keyboard is up the pill slides away and takes no touches', async () => {
    mockKeyboard = true;
    await render(tree());
    expect(screen.getByTestId('tab-bar').props.pointerEvents).toBe('none');
  });

  test('tab screens get the space the pill covers, from one source', async () => {
    await render(tree());
    expect(screen.getByTestId('tab-space').props.children).toBe(String(pillCover(16)));
    expect(pillCover(16)).toBe(16 + 8 + 64);
  });

  test('screens outside the tabs get no tab bar space', async () => {
    function Outside() {
      return <Text testID="outside">{String(useTabBarSpace())}</Text>;
    }
    await render(<Outside />);
    expect(screen.getByTestId('outside').props.children).toBe('0');
  });

  test.each(['medium', 'expanded'] as const)('a %s window gets the rail instead of the pill, with no bottom space, and the rail switches tabs', async (windowClass) => {
    mockWindow = windowClass;
    mockFocused = 'activity';
    mockPending = 3;
    await render(tree());
    expect(screen.queryByTestId('navigation-bar')).toBeNull();
    expect(screen.getByTestId('navigation-rail')).toBeTruthy();
    expect(screen.getByTestId('tab-space').props.children).toBe('0');
    expect(selected('activity')).toBe(true);
    expect(screen.getByTestId('tab-badge-activity')).toBeTruthy();
    await act(async () => fireEvent.press(screen.getByTestId('tab-button-discovery')));
    expect(mockSwitch).toHaveBeenCalledWith('discovery', {});
  });
});

describe('Android Material 3 Expressive pill', () => {
  function material() {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <MaterialPill />
      </SafeAreaProvider>
    );
  }

  test('the selected tab opens into the wide slot with its label beside the icon; the others stay narrow', async () => {
    mockFocused = 'mom';
    await render(material());
    const width = (name: string) => flat(`tab-button-${name}`).width;
    expect(width('mom')).toBeGreaterThan(width('chat'));
    expect(width('chat')).toBe(width('discovery'));
    expect(width('activity')).toBe(width('discovery'));
    expect(selected('mom')).toBe(true);
  });

  test('pressing a tab morphs the indicator corners and the indicator springs to the new tab', async () => {
    const view = await render(material());
    const resting = flat('tab-highlight').borderRadius;
    mockSpring.mockClear();
    await act(async () => fireEvent(screen.getByTestId('tab-button-activity'), 'pressIn'));
    expect(mockSpring).toHaveBeenCalledWith(1);
    await act(async () => view.rerender(material()));
    expect(flat('tab-highlight').borderRadius).toBeLessThan(resting);
    await act(async () => fireEvent.press(screen.getByTestId('tab-button-activity')));
    expect(mockSwitch).toHaveBeenCalledWith('activity', {});
    mockFocused = 'activity';
    await act(async () => view.rerender(material()));
    expect(mockSpring).toHaveBeenCalledWith(3);
  });

  test('the tonal capsule is see-through without a shadow, and solid with its elevation when legibility settings ask for it', async () => {
    const view = await render(material());
    expect(flat('navigation-bar').backgroundColor).toMatch(/^#[0-9A-F]{6}EB$/i);
    expect(flat('navigation-bar').elevation).toBeUndefined();
    mockSeeThrough = false;
    await act(async () => view.rerender(material()));
    expect(flat('navigation-bar').backgroundColor).toMatch(/^#[0-9A-F]{6}$/i);
    expect(flat('navigation-bar').elevation).toBe(3);
  });

  test('pending activities show the badge and the keyboard hides the bar from touches', async () => {
    mockPending = 7;
    mockKeyboard = true;
    await render(material());
    expect(screen.getByText('7', hidden)).toBeTruthy();
    expect(screen.getByTestId('tab-bar').props.pointerEvents).toBe('none');
  });
});

describe('pill geometry', () => {
  test.each([320, 360, 411, 480, 599])('on a %pdp phone the slots fill the capsule and the open slot keeps room for a label', (width) => {
    const capsule = pillWidth(width, 0);
    const { wide, narrow } = pillSlots(capsule, 4);
    expect(wide + 3 * narrow).toBeCloseTo(capsule - 2 * pillPadding);
    expect(narrow).toBeGreaterThanOrEqual(48);
    expect(labelRoom(wide)).toBeGreaterThanOrEqual(40);
    expect(capsule).toBeLessThanOrEqual(440);
  });

  test('at rest a closed tab centres its icon in its slot and the open tab centres icon plus label', () => {
    const { wide, narrow } = pillSlots(pillWidth(411, 0), 4);
    const label = 60;
    expect(openness(2, 2)).toBe(1);
    expect(openness(0, 2)).toBe(0);
    expect(glyphLeft(0, 2, wide, narrow, label)).toBeCloseTo((narrow - 24) / 2);
    expect(glyphLeft(2, 2, wide, narrow, label)).toBeCloseTo(slotLeft(2, 2, wide, narrow) + (wide - 24 - 8 - label) / 2);
    expect(glyphLeft(3, 2, wide, narrow, label)).toBeCloseTo(2 * narrow + wide + (narrow - 24) / 2);
  });

  test('between two tabs the slots still add up to the capsule, so nothing overlaps the edge', () => {
    const { wide, narrow } = pillSlots(pillWidth(411, 0), 4);
    for (const position of [0.25, 1.5, 2.9]) {
      const end = slotLeft(3, position, wide, narrow) + narrow + (wide - narrow) * openness(3, position);
      expect(end).toBeCloseTo(wide + 3 * narrow);
    }
  });
});
