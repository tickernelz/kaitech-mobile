import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useWindowClass } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';

const icons = {
  chat: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6A.5.5 0 0 1 5 19.2V16a2.5 2.5 0 0 1-1-2Z',
  discovery: 'M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.3 4.3-1.4 1.4-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Zm0 1.5.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z',
  mom: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Zm-6 8h2a4 4 0 0 0 8 0h2a6 6 0 0 1-5 5.9V20h3v2H8v-2h3v-3.1A6 6 0 0 1 6 11Z',
  activity: 'M12 3a6 6 0 0 1 6 6v4l2 3v1H4v-1l2-3V9a6 6 0 0 1 6-6Zm-2 16h4a2 2 0 0 1-4 0Z',
} as const;

type TabName = keyof typeof icons;
const tabs: TabName[] = ['chat', 'discovery', 'mom', 'activity'];

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
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d={icons[name]} fill={ink} />
        </Svg>
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
    <Tabs style={[styles.fill, { flexDirection: rail ? 'row' : 'column', backgroundColor: colors.canvas }]}>
      {rail ? null : <TabSlot style={styles.fill} />}
      <TabList
        accessibilityRole="tablist"
        style={[
          { backgroundColor: colors.surface, borderColor: colors.line },
          rail
            ? [styles.rail, { paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.lg, paddingLeft: insets.left }]
            : [styles.bar, { paddingBottom: Math.max(insets.bottom, space.sm) }],
        ]}>
        {tabs.map((name) => (
          <TabTrigger key={name} name={name} href={`/${name}`} asChild>
            <TabButton name={name} rail={rail} />
          </TabTrigger>
        ))}
      </TabList>
      {rail ? <TabSlot style={styles.fill} /> : null}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  rail: { flexDirection: 'column', justifyContent: 'flex-start', gap: space.md, width: 88, borderRightWidth: StyleSheet.hairlineWidth },
  barItem: { flex: 1, alignItems: 'center', gap: 2, minHeight: 52, justifyContent: 'center' },
  railItem: { alignItems: 'center', gap: space.xs, minHeight: 56, paddingHorizontal: space.xs },
  pill: { width: 56, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  railPill: { height: 32 },
  label: { textAlign: 'center', maxWidth: '100%' },
});
