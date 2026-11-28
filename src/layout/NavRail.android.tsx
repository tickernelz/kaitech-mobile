import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../theme';
import { Icon } from '../ui/icons';
import { Pressable } from '../ui/Pressable';
import { Text } from '../ui/Text';
import { hideWhen, useCovered } from '../ui/cover';
import { useReduceMotion } from '../theme/reduceMotion';
import { useAccess } from '../auth/useAccess';
import { PillBadge } from './PillBadge';
import { badgeText, tabIcons, tabSpoken, tabsFor, type TabName } from './tabs';
import { useTab } from './useTab';
import { useTabCounts } from './useTabCounts';

function RailItem({ name, count }: { name: TabName; count: number }) {
  const { t } = useTranslation();
  const { material } = useTheme();
  const reduceMotion = useReduceMotion();
  const { focused, open } = useTab(name);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  return (
    <Pressable
      onPress={open}
      onFocus={() => setKeyboardFocus(true)}
      onBlur={() => setKeyboardFocus(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tabSpoken(t, name, count)}
      testID={`tab-button-${name}`}
      style={styles.item}>
      <View style={styles.indicatorBox}>
        <Pressable
          onPress={open}
          accessible={false}
          importantForAccessibility="no"
          android_ripple={{ color: `${material.onSurface}1A`, foreground: true }}
          style={[styles.indicator, focused && { backgroundColor: material.secondaryContainer }, keyboardFocus && { borderColor: material.secondary, borderWidth: 3 }]}>
          <Icon name={tabIcons[name]} color={focused ? material.onSecondaryContainer : material.onSurfaceVariant} variant={focused ? 'fill' : 'line'} />
        </Pressable>
        <PillBadge
          name={name}
          text={badgeText(count)}
          fill={name === 'activity' ? material.error : material.primary}
          ink={name === 'activity' ? material.onError : material.onPrimary}
          reduceMotion={reduceMotion}
          style={styles.badge}
        />
      </View>
      <Text variant="label" numberOfLines={1} maxFontSizeMultiplier={1.3} style={[styles.label, { color: focused ? material.onSurface : material.onSurfaceVariant }]}>
        {t(`tabs.${name}`)}
      </Text>
    </Pressable>
  );
}

export function NavRail() {
  const { material } = useTheme();
  const insets = useSafeAreaInsets();
  const covered = useCovered();
  const counts = useTabCounts();
  return (
    <View
      accessibilityRole="tablist"
      importantForAccessibility={hideWhen(covered)}
      style={[styles.rail, { backgroundColor: material.surface, width: railWidth + insets.left, paddingLeft: insets.left, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]} testID="navigation-rail">
      {tabsFor(useAccess()).map((name) => (
        <RailItem key={name} name={name} count={counts[name]} />
      ))}
    </View>
  );
}

const railWidth = 80;

const styles = StyleSheet.create({
  rail: { flexDirection: 'column', alignItems: 'center', gap: space.md },
  item: { width: railWidth, alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
  indicatorBox: { width: 56 },
  indicator: { height: 32, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badge: { top: -2, left: '50%', marginLeft: 4 },
  label: { textAlign: 'center', maxWidth: '100%' },
});
