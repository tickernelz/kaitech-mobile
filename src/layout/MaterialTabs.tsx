import { Badge, BadgedBox, NavigationBar, NavigationBarItem, RNHostView, Text as ComposeText } from '@expo/ui/jetpack-compose';
import { semantics, testID } from '@expo/ui/jetpack-compose/modifiers';
import { TabList, TabSlot, TabTrigger, Tabs, useTabTrigger } from 'expo-router/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingActivities } from '../features/activity/useActivityOverview';
import { radius, space, useTheme } from '../theme';
import { Icon, type IconName } from '../ui/icons';
import { MaterialHost } from '../ui/MaterialHost';
import { Text } from '../ui/Text';
import { badgeText, routes, tabs, type TabName } from './tabs';
import { useWindowClass } from './windowClass';

const icons = { chat: 'chat', discovery: 'compass', mom: 'minutes', activity: 'bell' } as const satisfies Record<TabName, IconName>;

function useTab(name: TabName) {
  const { switchTab, trigger } = useTabTrigger({ name: routes[name].name });
  const focused = !!trigger?.isFocused;
  return { focused, open: () => (focused ? undefined : switchTab(routes[name].name, {})) };
}

function Glyph({ name, focused }: { name: TabName; focused: boolean }) {
  const { material } = useTheme();
  return (
    <RNHostView matchContents>
      <Icon name={icons[name]} color={focused ? material.onSecondaryContainer : material.onSurfaceVariant} variant={focused ? 'fill' : 'line'} />
    </RNHostView>
  );
}

function ActivityGlyph({ focused }: { focused: boolean }) {
  const { t } = useTranslation();
  const count = usePendingActivities();
  const badge = badgeText(count);
  if (!badge) return <Glyph name="activity" focused={focused} />;
  return (
    <BadgedBox>
      <Glyph name="activity" focused={focused} />
      <BadgedBox.Badge>
        <Badge modifiers={[testID('tab-badge-activity'), semantics({ contentDescription: t('activities.pending', { count }) })]}>
          <ComposeText>{badge}</ComposeText>
        </Badge>
      </BadgedBox.Badge>
    </BadgedBox>
  );
}

function RailBadge() {
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

function BarItem({ name }: { name: TabName }) {
  const { t } = useTranslation();
  const { material } = useTheme();
  const { focused, open } = useTab(name);
  return (
    <NavigationBarItem
      selected={focused}
      onClick={open}
      alwaysShowLabel
      colors={{ selectedIndicatorColor: material.secondaryContainer, selectedTextColor: material.onSurface, unselectedTextColor: material.onSurfaceVariant }}
      modifiers={[testID(`tab-button-${name}`)]}>
      <NavigationBarItem.Icon>{name === 'activity' ? <ActivityGlyph focused={focused} /> : <Glyph name={name} focused={focused} />}</NavigationBarItem.Icon>
      <NavigationBarItem.Label>
        <ComposeText maxLines={1} style={{ typography: 'labelMedium' }}>
          {t(`tabs.${name}`)}
        </ComposeText>
      </NavigationBarItem.Label>
    </NavigationBarItem>
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
      style={styles.railItem}>
      <Pressable
        onPress={open}
        accessible={false}
        importantForAccessibility="no"
        android_ripple={{ color: `${material.onSurface}1A`, foreground: true }}
        style={[styles.indicator, focused && { backgroundColor: material.secondaryContainer }, keyboardFocus && { borderColor: material.secondary, borderWidth: 3 }]}>
        <Icon name={icons[name]} color={focused ? material.onSecondaryContainer : material.onSurfaceVariant} variant={focused ? 'fill' : 'line'} />
      </Pressable>
      {name === 'activity' ? <RailBadge /> : null}
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
            <RailItem key={name} name={name} />
          ))}
        </View>
      ) : null}
      <TabSlot style={styles.fill} />
      {rail ? null : (
        <MaterialHost matchContents={{ vertical: true }} style={styles.bar}>
          <NavigationBar containerColor={material.surfaceContainer}>
            {tabs.map((name) => (
              <BarItem key={name} name={name} />
            ))}
          </NavigationBar>
        </MaterialHost>
      )}
    </Tabs>
  );
}

const railWidth = 80;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hidden: { display: 'none' },
  bar: { width: '100%' },
  rail: { flexDirection: 'column', alignItems: 'center', gap: space.md },
  railItem: { width: railWidth, alignItems: 'center', gap: space.xs, paddingVertical: space.xs },
  indicator: { width: 56, height: 32, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 0, left: railWidth / 2 + 4, minWidth: 16, height: 16, paddingHorizontal: 4, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, lineHeight: 16 },
  label: { textAlign: 'center', maxWidth: '100%' },
});
