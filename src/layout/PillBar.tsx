import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { radius, useTheme, type Colors } from '../theme';
import { GlassCapsule } from '../ui/GlassCapsule';
import { Icon } from '../ui/icons';
import { Pressable } from '../ui/Pressable';
import { PillBadge } from './PillBadge';
import { pill } from '../ui/pill';
import { pillHeight, pillPadding } from './tabBar';
import { tabIcons } from './tabs';
import { usePillBar, type PillBarState, type PillTab } from './usePillBar';

function Glyph({ tab, bar, colors, slot }: { tab: PillTab; bar: PillBarState; colors: Colors; slot: number }) {
  const { index } = tab;
  const { pressed, pressScale } = bar;
  const place = useAnimatedStyle(() => ({ transform: [{ translateX: index * slot }, { scale: pressed.get() === index ? 1 - 0.08 * pressScale.get() : 1 }] }));
  return (
    <Animated.View style={[styles.glyph, { width: slot }, place]}>
      <View style={styles.icon}>
        <Icon name={tabIcons[tab.name]} color={tab.focused ? colors.selectInk : colors.ink} variant={tab.focused ? 'fill' : 'line'} />
        {tab.name === 'activity' ? <PillBadge text={bar.badge} fill={colors.danger} ink={colors.onDanger} edge={colors.surface} reduceMotion={bar.reduceMotion} style={styles.badge} /> : null}
      </View>
      <Text numberOfLines={1} maxFontSizeMultiplier={1.2} style={[styles.label, { color: tab.focused ? colors.selectInk : colors.ink }]} testID={`tab-label-${tab.name}`}>
        {tab.label}
      </Text>
    </Animated.View>
  );
}

export function PillBar() {
  const { colors, scheme } = useTheme();
  const bar = usePillBar();
  const { position, pressScale, hidden, cover, width } = bar;
  const slot = (width - 2 * pillPadding) / bar.items.length;
  const lift = useAnimatedStyle(() => ({ opacity: 1 - hidden.get(), transform: [{ translateY: hidden.get() * cover }] }));
  const lens = useAnimatedStyle(() => {
    const travel = Math.sin(Math.PI * (position.get() - Math.floor(position.get())));
    const grow = 1 + 0.06 * travel + 0.05 * pressScale.get();
    return { opacity: Math.min(1, Math.max(0, position.get() + 1)), transform: [{ translateX: position.get() * slot }, { scaleX: grow }, { scaleY: grow }] };
  });
  return (
    <Animated.View
      pointerEvents={bar.keyboard ? 'none' : 'box-none'}
      testID="tab-bar"
      style={[styles.wrap, { bottom: bar.bottom, paddingLeft: bar.sideInsets.left, paddingRight: bar.sideInsets.right }, lift]}>
      <GlassCapsule
        accessibilityRole="tablist"
        solid={[scheme === 'dark' ? styles.shadowDark : styles.shadowLight, styles.edge, { backgroundColor: colors.surface, borderColor: colors.line }]}
        style={[styles.capsule, { width }]}
        testID="navigation-bar">
        <View style={styles.track} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.lens, { width: slot, backgroundColor: colors.select }, lens]} testID="tab-highlight" />
          {bar.items.map((tab) => (
            <Glyph key={tab.name} tab={tab} bar={bar} colors={colors} slot={slot} />
          ))}
        </View>
        {bar.items.map((tab) => (
          <Pressable
            key={tab.name}
            onPress={tab.press}
            onPressIn={tab.pressIn}
            onPressOut={tab.pressOut}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab.focused }}
            accessibilityLabel={tab.spoken}
            testID={`tab-button-${tab.name}`}
            style={[styles.slot, { width: slot }]}
          />
        ))}
      </GlassCapsule>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  capsule: { height: pillHeight, padding: pillPadding, borderRadius: radius.pill, flexDirection: 'row' },
  edge: { borderWidth: StyleSheet.hairlineWidth },
  shadowLight: { shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  shadowDark: { shadowColor: '#000000', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  track: { position: 'absolute', top: pillPadding, left: pillPadding, right: pillPadding, bottom: pillPadding },
  lens: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radius.pill },
  glyph: { position: 'absolute', top: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: pill.tab.labelGap },
  icon: { width: 24, height: 24 },
  label: { fontSize: 10, lineHeight: 12, fontWeight: '600', maxWidth: '100%', paddingHorizontal: 4 },
  slot: { height: pillHeight - 2 * pillPadding, borderRadius: radius.pill },
  badge: { top: -6, left: 14 },
});
