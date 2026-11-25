import { TabList, TabSlot, TabTrigger, Tabs, useTabTrigger } from 'expo-router/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '../ui/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingActivities } from '../features/activity/useActivityOverview';
import { radius, space, useTheme } from '../theme';
import { Icon, type IconName } from '../ui/icons';
import { Text } from '../ui/Text';
import { badgeText, routes, tabs, type TabName } from './tabs';
import { useWindowClass } from './windowClass';

const icons = { chat: 'chat', discovery: 'compass', mom: 'minutes', activity: 'bell' } as const satisfies Record<TabName, IconName>;

type Kind = 'bar' | 'rail';

const indicatorWidth: Record<Kind, number> = { bar: 64, rail: 56 };

function useTab(name: TabName) {
  const { switchTab, trigger } = useTabTrigger({ name: routes[name].name });
  const focused = !!trigger?.isFocused;
  return { focused, open: () => (focused ? undefined : switchTab(routes[name].name, {})) };
}

function TabBadge() {
  const { t } = useTranslation();
  const { material } = useTheme();
  const count = usePendingActivities();
  const badge = badgeText(count);
  if (!badge) return null;
  return (
    <View style={[styles.badge, { backgroundColor: material.error }]} accessibilityLabel={t('activities.pending', { count })} testID="tab-badge-activity">
      <Text variant="label" maxFontSizeMultiplier={1.2} style={[styles.badgeText, { color: material.onError }]}>
        {badge}
      </Text>
    </View>
  );
}

function TabItem({ name, kind }: { name: TabName; kind: Kind }) {
  const { t } = useTranslation();
  const { material } = useTheme();
  const { focused, open } = useTab(name);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  return (
    <Pressable
      onPress={open}
      onFocus={() => setKeyboardFocus(true)}
      onBlur={() => setKeyboardFocus(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={t(`tabs.${name}`)}
      testID={`tab-button-${name}`}
      style={kind === 'rail' ? styles.railItem : styles.barItem}>
      <View style={{ width: indicatorWidth[kind] }}>
        <Pressable
          onPress={open}
          accessible={false}
          importantForAccessibility="no"
          android_ripple={{ color: `${material.onSurface}1A`, foreground: true }}
          style={[styles.indicator, focused && { backgroundColor: material.secondaryContainer }, keyboardFocus && { borderColor: material.secondary, borderWidth: 3 }]}>
          <Icon name={icons[name]} color={focused ? material.onSecondaryContainer : material.onSurfaceVariant} variant={focused ? 'fill' : 'line'} />
        </Pressable>
        {name === 'activity' ? <TabBadge /> : null}
      </View>
      <Text variant="label" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, { color: focused ? material.onSurface : material.onSurfaceVariant }]}>
        {t(`tabs.${name}`)}
      </Text>
    </Pressable>
  );
}

export function MaterialTabs() {
  const { material } = useTheme();
  const insets = useSafeAreaInsets();
  const { windowClass } = useWindowClass();
  const rail = windowClass !== 'compact';
  return (
    <Tabs style={[styles.fill, { flexDirection: rail ? 'row' : 'column', backgroundColor: material.background }]}>
      <TabList style={styles.hidden}>
        {tabs.map((name) => (
          <TabTrigger key={name} name={routes[name].name} href={routes[name].href} />
        ))}
      </TabList>
      {rail ? (
        <View accessibilityRole="tablist" style={[styles.rail, { backgroundColor: material.surface, width: railWidth + insets.left, paddingLeft: insets.left, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}>
          {tabs.map((name) => (
            <TabItem key={name} name={name} kind="rail" />
          ))}
        </View>
      ) : null}
      <TabSlot style={styles.fill} />
      {rail ? null : (
        <View accessibilityRole="tablist" style={[styles.bar, { backgroundColor: material.surfaceContainer, paddingBottom: insets.bottom + space.lg, paddingLeft: insets.left, paddingRight: insets.right }]} testID="navigation-bar">
          {tabs.map((name) => (
            <TabItem key={name} name={name} kind="bar" />
          ))}
        </View>
      )}
    </Tabs>
  );
}

const railWidth = 80;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
  bar: { flexDirection: 'row', paddingTop: space.md, gap: space.sm },
  barItem: { flex: 1, alignItems: 'center', gap: space.xs, minHeight: 48 },
  rail: { flexDirection: 'column', alignItems: 'center', gap: space.md },
  railItem: { width: railWidth, alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
  indicator: { height: 32, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 0, left: '50%', marginLeft: 4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, lineHeight: 16 },
  label: { textAlign: 'center', maxWidth: '100%' },
});
