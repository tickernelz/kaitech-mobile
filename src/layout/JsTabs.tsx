import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { duration, easing } from '../theme/motion';
import { Icon, type IconName } from '../ui/icons';
import { Text } from '../ui/Text';
import { usePendingActivities } from '../features/activity/useActivityOverview';
import { badgeText, routes, tabs, type TabName } from './tabs';
import { useWindowClass } from './windowClass';

const icons = { chat: 'chat', discovery: 'compass', mom: 'minutes', activity: 'bell' } as const satisfies Record<TabName, IconName>;

function TabButton({ name, rail, isFocused, ...props }: TabTriggerSlotProps & { name: TabName; rail: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    const target = isFocused ? 1 : 0;
    shown.value = reduceMotion ? target : withTiming(target, { duration: duration.base, easing: easing.standard });
  }, [isFocused, reduceMotion, shown]);
  const indicator = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scaleX: 0.5 + shown.value / 2 }] }));
  const glyph = isFocused ? colors.onPrimary : colors.inkSoft;
  return (
    <Pressable
      {...(props as ComponentProps<typeof Pressable>)}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={t(`tabs.${name}`)}
      testID={`tab-button-${name}`}
      style={rail ? styles.railItem : styles.barItem}>
      <View collapsable={false} style={styles.pill}>
        <Animated.View style={[styles.indicator, { backgroundColor: colors.primary }, indicator]} testID={`tab-indicator-${name}`} />
        <Icon name={icons[name]} color={glyph} variant={isFocused ? 'fill' : 'line'} />
        {name === 'activity' ? <ActivityBadge /> : null}
      </View>
      {isFocused ? (
        <Text variant="label" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, { color: colors.ink }]}>
          {t(`tabs.${name}`)}
        </Text>
      ) : null}
    </Pressable>
  );
}

function ActivityBadge() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const count = usePendingActivities();
  const text = badgeText(count);
  if (!text) return null;
  return (
    <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]} accessibilityLabel={t('activities.pending', { count })} testID="tab-badge-activity">
      <Text variant="label" maxFontSizeMultiplier={1.2} style={[styles.badgeText, { color: colors.onPrimary }]}>
        {text}
      </Text>
    </View>
  );
}

export function JsTabs() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { windowClass } = useWindowClass();
  const rail = windowClass !== 'compact';
  return (
    <Tabs style={[styles.fill, { flexDirection: rail ? 'row' : 'column-reverse', backgroundColor: colors.canvas }]}>
      <TabList
        accessibilityRole="tablist"
        style={[
          { backgroundColor: colors.surface, borderColor: colors.line },
          rail
            ? [styles.rail, { width: railWidth + insets.left, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]
            : [styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }],
        ]}>
        {tabs.map((name) => (
          <TabTrigger key={name} name={routes[name].name} href={routes[name].href} asChild>
            <TabButton name={name} rail={rail} />
          </TabTrigger>
        ))}
      </TabList>
      <TabSlot style={styles.fill} />
    </Tabs>
  );
}

const railWidth = 88;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  rail: { flexDirection: 'column', justifyContent: 'flex-start', gap: space.md, borderRightWidth: StyleSheet.hairlineWidth },
  barItem: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52, justifyContent: 'flex-start' },
  railItem: { alignItems: 'center', gap: space.xs, minHeight: 56, paddingHorizontal: space.xs },
  pill: { width: 64, height: 32, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: 6, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12 },
  indicator: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.pill },
  label: { textAlign: 'center', maxWidth: '100%' },
});
