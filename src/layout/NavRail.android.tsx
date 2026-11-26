import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingActivities } from '../features/activity/useActivityOverview';
import { radius, space, useTheme } from '../theme';
import { Icon } from '../ui/icons';
import { Pressable } from '../ui/Pressable';
import { Text } from '../ui/Text';
import { badgeText, tabIcons, tabs, type TabName } from './tabs';
import { useTab } from './useTab';

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

function RailItem({ name }: { name: TabName }) {
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
        {name === 'activity' ? <TabBadge /> : null}
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
  return (
    <View accessibilityRole="tablist" style={[styles.rail, { backgroundColor: material.surface, width: railWidth + insets.left, paddingLeft: insets.left, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg }]} testID="navigation-rail">
      {tabs.map((name) => (
        <RailItem key={name} name={name} />
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
  badge: { position: 'absolute', top: 0, left: '50%', marginLeft: 4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, lineHeight: 16 },
  label: { textAlign: 'center', maxWidth: '100%' },
});
