import { act, render, screen, within } from '@testing-library/react-native';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Conversation } from '../src/features/chat/types';

let mockState: Record<string, unknown> = {};
const mockListeners = new Set<() => void>();
let mockWindow: 'compact' | 'medium' | 'expanded' = 'compact';

jest.mock('react-native-reanimated', () => {
  const { View: Plain } = require('react-native');
  const chain = (): unknown => new Proxy(() => undefined, { get: () => chain(), apply: () => chain() });
  return {
    __esModule: true,
    default: { View: Plain, Text: require('react-native').Text },
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
    withSpring: (value: unknown) => value,
    withTiming: (value: unknown) => value,
    interpolateColor: (_: number, __: number[], colors: string[]) => colors[1],
  };
});
jest.mock('expo-router/ui', () => ({
  Tabs: ({ children }: { children: unknown }) => children,
  TabList: () => null,
  TabTrigger: () => null,
  TabSlot: () => null,
  defaultTabsSlotRender: () => null,
  useTabTrigger: ({ name }: { name: string }) => ({ trigger: { isFocused: name === 'index' }, switchTab: () => undefined }),
}));
jest.mock('expo-haptics', () => ({ selectionAsync: async () => undefined, performAndroidHapticsAsync: async () => undefined, AndroidHaptics: { Virtual_Key: 'virtual-key' } }));
jest.mock('react-native-keyboard-controller', () => ({ useKeyboardState: (pick: (state: { isVisible: boolean; height: number }) => unknown) => pick({ isVisible: false, height: 0 }) }));
jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('../src/features/activity/useActivityOverview', () => ({ usePendingActivities: () => 0 }));
jest.mock('../src/layout/windowClass', () => ({ useWindowClass: () => ({ windowClass: mockWindow, short: false }), useLargeText: () => false }));
jest.mock('../src/theme/reduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('../src/ui/glass', () => ({ useSeeThrough: () => false, useSurface: () => 'solid' }));
jest.mock('../src/features/chat/chat', () => ({
  useChat: <T,>(select: (state: Record<string, unknown>) => T): T => {
    const { useSyncExternalStore } = require('react');
    return useSyncExternalStore(
      (listener: () => void) => {
        mockListeners.add(listener);
        return () => mockListeners.delete(listener);
      },
      () => select(mockState),
    );
  },
  loadArchived: async () => undefined,
  loadMoreConversations: async () => undefined,
  refreshConversations: async () => undefined,
}));
jest.mock('../src/features/chat/starred', () => ({ refreshStarred: async () => undefined }));
jest.mock('../src/features/chat/push', () => ({ pushSupported: true }));
jest.mock('../src/screens/HeaderActions', () => ({ HeaderActions: () => null }));
jest.mock('../src/features/chat/ui/thread/ListSheets', () => ({ StarredSheet: () => null }));
jest.mock('../src/features/chat/ui/coworker/Tickets', () => ({ TicketsSheet: () => null }));
jest.mock('../src/ui/Refresh', () => ({ Refresh: () => null }));
jest.mock('../src/ui/RowActions', () => ({ RowActions: () => null }));
jest.mock('expo-router/native-tabs', () => {
  const { createElement } = require('react');
  const { Text: Words, View: Box } = require('react-native');
  const Trigger = ({ children, testID }: { children: unknown; testID: string }) => createElement(Box, { testID }, children);
  Trigger.Icon = function Icon() {
    return null;
  };
  Trigger.Label = function Label({ children }: { children: string }) {
    return createElement(Words, null, children);
  };
  Trigger.Badge = function Badge({ children, hidden: off }: { children?: string; hidden?: boolean }) {
    return off ? null : createElement(Words, { testID: 'native-badge' }, children);
  };
  const NativeTabs = ({ children }: { children: unknown }) => createElement(Box, null, children);
  NativeTabs.Trigger = Trigger;
  return { NativeTabs };
});
jest.mock('@shopify/flash-list', () => ({ FlashList: ({ ListHeaderComponent }: { ListHeaderComponent: unknown }) => ListHeaderComponent }));

require('../src/i18n');
const { unreadCount } = require('../src/features/chat/listFilters') as typeof import('../src/features/chat/listFilters');
const { noFeatures } = require('../src/features/chat/features') as typeof import('../src/features/chat/features');
const { ConversationList } = require('../src/features/chat/ui/ConversationList') as typeof import('../src/features/chat/ui/ConversationList');
const { PillTabs } = require('../src/layout/PillTabs') as typeof import('../src/layout/PillTabs');
const { PillBar: MaterialPill } = require('../src/layout/PillBar.android') as typeof import('../src/layout/PillBar.android');
const { NavRail: MaterialRail } = require('../src/layout/NavRail.android') as typeof import('../src/layout/NavRail.android');
const { NavRail } = require('../src/layout/NavRail') as typeof import('../src/layout/NavRail');
const { GlassTabs } = require('../src/layout/GlassTabs') as typeof import('../src/layout/GlassTabs');

const metrics = { frame: { x: 0, y: 0, width: 411, height: 914 }, insets: { top: 24, left: 0, right: 0, bottom: 16 } };
const hidden = { includeHiddenElements: true };

function conversation(id: number, unread: number, extra: Partial<Conversation> = {}): Conversation {
  return { id, type: 'group', name: `Room ${id}`, partnerId: null, photo: null, unread, mutedUntil: null, activityAt: id, last: null, pinned: null, archived: null, ...extra };
}

function seed(conversations: Conversation[], archived: Conversation[] = []) {
  mockState = { conversations, archived, archivedSummary: null, listLoading: false, listLoaded: true, listError: null, online: true, pending: [], features: noFeatures, starred: 0, accountId: 'u1_a', partnerId: 3 };
}

function update(conversations: Conversation[]) {
  mockState = { ...mockState, conversations };
  mockListeners.forEach((listener) => listener());
}

function screenWith(bar: React.ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <View>
        <ConversationList selectedId={null} onOpen={() => undefined} onNew={() => undefined} />
        {bar}
      </View>
    </SafeAreaProvider>
  );
}

const tabBadge = () => screen.queryByTestId('tab-badge-chat', hidden);
const count = (testID: string) => {
  const node = screen.queryByTestId(testID, hidden);
  return node ? within(node).queryByText(/^\d+\+?$/, hidden)?.props.children : undefined;
};
const tabText = () => {
  const text = count('tab-badge-chat');
  expect(count('chat-filter-unread')).toBe(text);
  return text;
};
const chipLabel = () => screen.getByTestId('chat-filter-unread').props.accessibilityLabel as string | undefined;
const tabLabel = () => screen.getByTestId('tab-button-chat').props.accessibilityLabel as string;

beforeEach(() => {
  mockWindow = 'compact';
  mockListeners.clear();
});

describe('unread conversation count', () => {
  test.each([
    [[], 0],
    [[conversation(1, 1)], 1],
    [[conversation(1, 0), conversation(2, 4), conversation(3, 0)], 1],
    [Array.from({ length: 150 }, (_, index) => conversation(index + 1, 2)), 150],
  ])('counts conversations with unread messages, not messages', (conversations, count) => {
    expect(unreadCount(conversations)).toBe(count);
  });

  test('a muted conversation counts like it does in the Unread chip', () => {
    expect(unreadCount([conversation(1, 3, { mutedUntil: '2099-01-01 00:00:00' })])).toBe(1);
  });
});

describe('Chat tab badge on the iOS 26 native tab bar', () => {
  test('the native Chat badge carries the chip number and hides at zero', async () => {
    seed([conversation(1, 3), conversation(2, 1)]);
    await render(screenWith(<GlassTabs />));
    expect(within(screen.getByTestId('tab-button-chat')).getByTestId('native-badge').props.children).toBe('2');
    expect(count('chat-filter-unread')).toBe('2');
    expect(within(screen.getByTestId('tab-button-activity')).queryByTestId('native-badge')).toBeNull();
    await act(async () => update([conversation(1, 0), conversation(2, 0)]));
    expect(within(screen.getByTestId('tab-button-chat')).queryByTestId('native-badge')).toBeNull();
  });
});

describe.each([
  ['floating pill', () => <PillTabs />],
  ['Material pill', () => <MaterialPill />],
  ['Material rail', () => <MaterialRail />],
  ['rail', () => <NavRail />],
])('Chat tab badge on the %s and the Unread chip', (_, bar) => {
  test('no unread conversation shows no badge, no chip count and a plain tab label', async () => {
    seed([conversation(1, 0)]);
    await render(screenWith(bar()));
    expect(tabBadge()).toBeNull();
    expect(chipLabel()).toBeUndefined();
    expect(tabLabel()).toBe('Chat');
  });

  test('the tab and the chip show the same number and follow reads and mark-unread live', async () => {
    seed([conversation(1, 2), conversation(2, 5, { mutedUntil: '2099-01-01 00:00:00' }), conversation(3, 0)], [conversation(9, 4, { archived: true })]);
    await render(screenWith(bar()));
    expect(tabText()).toBe('2');
    expect(chipLabel()).toMatch(/, 2$/);
    expect(tabLabel()).toMatch(/^Chat, 2 /);
    await act(async () => update([conversation(1, 0), conversation(2, 5), conversation(3, 0)]));
    expect(tabText()).toBe('1');
    expect(chipLabel()).toMatch(/, 1$/);
    await act(async () => update([conversation(1, 1), conversation(2, 5), conversation(3, 0)]));
    expect(tabText()).toBe('2');
    expect(chipLabel()).toMatch(/, 2$/);
    await act(async () => update([conversation(1, 0), conversation(2, 0), conversation(3, 0)]));
    expect(tabBadge()).toBeNull();
    expect(chipLabel()).toBeUndefined();
  });

  test('above 99 both read 99+ and the tab still speaks the full count', async () => {
    seed(Array.from({ length: 150 }, (_, index) => conversation(index + 1, 1)));
    await render(screenWith(bar()));
    expect(tabText()).toBe('99+');
    expect(screen.getAllByText('99+', hidden)).toHaveLength(2);
    expect(tabLabel()).toMatch(/150/);
  });
});
