import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, stroke, useTheme } from '../theme';
import { duration, easing } from '../theme/motion';
import { useReduceMotion } from '../theme/reduceMotion';
import { Icon } from '../ui/icons';
import { Pressable } from '../ui/Pressable';
import { Text } from '../ui/Text';
import { useAccess } from '../auth/useAccess';
import { PillBadge } from './PillBadge';
import { badgeText, tabIcons, tabSpoken, tabsFor, type TabName } from './tabs';
import { useTab } from './useTab';
import { useTabCounts } from './useTabCounts';

function RailItem({ name, count }: { name: TabName; count: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { focused, open } = useTab(name);
  const reduceMotion = useReduceMotion();
  const shown = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    const target = focused ? 1 : 0;
    shown.set(reduceMotion ? target : withTiming(target, { duration: duration.base, easing: easing.standard }));
  }, [focused, reduceMotion, shown]);
  const indicator = useAnimatedStyle(() => ({ opacity: shown.get(), transform: [{ scaleX: 0.5 + shown.get() / 2 }] }));
  return (
    <Pressable onPress={open} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={tabSpoken(t, name, count)} testID={`tab-button-${name}`} style={styles.item}>
      <View collapsable={false} style={styles.pill}>
        <Animated.View style={[styles.indicator, { backgroundColor: colors.primary }, indicator]} />
        <Icon name={tabIcons[name]} color={focused ? colors.onPrimary : colors.inkSoft} variant={focused ? 'fill' : 'line'} />
        <PillBadge name={name} text={badgeText(count)} fill={name === 'activity' ? colors.danger : colors.primary} ink={colors.onPrimary} edge={colors.surface} reduceMotion={reduceMotion} style={styles.badge} />
      </View>
      {focused ? (
        <Text variant="label" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, { color: colors.ink }]}>
          {t(`tabs.${name}`)}
        </Text>
      ) : null}
    </Pressable>
  );
}

export function NavRail() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const counts = useTabCounts();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.rail, { backgroundColor: colors.surface, borderColor: colors.line, width: railWidth + insets.left, paddingLeft: insets.left, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]}
      testID="navigation-rail">
      {tabsFor(useAccess()).map((name) => (
        <RailItem key={name} name={name} count={counts[name]} />
      ))}
    </View>
  );
}

const railWidth = 88;

const styles = StyleSheet.create({
  rail: { flexDirection: 'column', justifyContent: 'flex-start', gap: space.md, borderRightWidth: stroke.hairline },
  item: { alignItems: 'center', gap: space.xs, minHeight: 56, paddingHorizontal: space.xs },
  pill: { width: 64, height: 32, alignItems: 'center', justifyContent: 'center' },
  badge: { top: -2, right: 6 },
  indicator: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: radius.pill },
  label: { textAlign: 'center', maxWidth: '100%' },
});
