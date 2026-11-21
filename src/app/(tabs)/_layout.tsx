import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowClass } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { Icon, type IconName } from '../../ui/icons';
import { Text } from '../../ui/Text';

const icons = { chat: 'chat', discovery: 'compass', mom: 'minutes', activity: 'bell' } as const satisfies Record<string, IconName>;

type TabName = keyof typeof icons;
const tabs: TabName[] = ['chat', 'discovery', 'mom', 'activity'];
const routes: Record<TabName, { name: string; href: '/' | '/discovery' | '/mom' | '/activity' }> = {
  chat: { name: 'index', href: '/' },
  discovery: { name: 'discovery', href: '/discovery' },
  mom: { name: 'mom', href: '/mom' },
  activity: { name: 'activity', href: '/activity' },
};

function TabButton({ name, rail, isFocused, ...props }: TabTriggerSlotProps & { name: TabName; rail: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const ink = isFocused ? colors.selectInk : colors.inkSoft;
  return (
    <Pressable
      {...(props as ComponentProps<typeof Pressable>)}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={t(`tabs.${name}`)}
      testID={`tab-button-${name}`}
      style={rail ? styles.railItem : styles.barItem}>
      <View style={[styles.pill, rail && styles.railPill, isFocused && { backgroundColor: colors.select }]}>
        <Icon name={icons[name]} color={ink} variant={isFocused ? 'fill' : 'line'} />
      </View>
      <Text variant="label" maxFontSizeMultiplier={1.5} style={[styles.label, { color: ink }]}>
        {t(`tabs.${name}`)}
      </Text>
    </Pressable>
  );
}

export default function TabsLayout() {
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
  barItem: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52, justifyContent: 'center' },
  railItem: { alignItems: 'center', gap: space.xs, minHeight: 56, paddingHorizontal: space.xs },
  pill: { width: 56, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  railPill: { height: 32 },
  label: { textAlign: 'center', maxWidth: '100%' },
});
