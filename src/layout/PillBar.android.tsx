import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { radius, space, useTheme, type MaterialColors } from '../theme';
import { Icon } from '../ui/icons';
import { Pressable } from '../ui/Pressable';
import { Text } from '../ui/Text';
import { PillBadge } from './PillBadge';
import { glyphLeft, labelRoom, openness, pillHeight, pillPadding, pillSlots } from './tabBar';
import { tabIcons } from './tabs';
import { usePillBar, type PillBarState, type PillTab } from './usePillBar';

const indicatorRadius = (pillHeight - 2 * pillPadding) / 2;

function Glyph({ tab, bar, material, wide, narrow }: { tab: PillTab; bar: PillBarState; material: MaterialColors; wide: number; narrow: number }) {
  const label = useSharedValue(0);
  const { index } = tab;
  const { position, pressed, pressScale } = bar;
  const place = useAnimatedStyle(() => {
    const squeeze = pressed.get() === index ? 1 - 0.1 * pressScale.get() : 1;
    return { transform: [{ translateX: glyphLeft(index, position.get(), wide, narrow, label.get()) }, { scale: squeeze }] };
  });
  const words = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (openness(index, position.get()) - 0.5) * 2)) }));
  return (
    <Animated.View style={[styles.glyph, place]}>
      <View style={styles.icon}>
        <Icon name={tabIcons[tab.name]} color={tab.focused ? material.onSecondaryContainer : material.onSurfaceVariant} variant={tab.focused ? 'fill' : 'line'} />
        {tab.name === 'activity' ? <PillBadge text={bar.badge} fill={material.error} ink={material.onError} reduceMotion={bar.reduceMotion} style={styles.badge} /> : null}
      </View>
      <Animated.View style={words}>
        <Text
          variant="label"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          onLayout={(event) => label.set(event.nativeEvent.layout.width)}
          style={[styles.label, { color: material.onSecondaryContainer, maxWidth: labelRoom(wide) }]}
          testID={`tab-label-${tab.name}`}>
          {tab.label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

function Slot({ tab, width, focusRing }: { tab: PillTab; width: number; focusRing: string }) {
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  return (
    <Pressable
      onPress={tab.press}
      onPressIn={tab.pressIn}
      onPressOut={tab.pressOut}
      onFocus={() => setKeyboardFocus(true)}
      onBlur={() => setKeyboardFocus(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: tab.focused }}
      accessibilityLabel={tab.spoken}
      testID={`tab-button-${tab.name}`}
      style={[styles.slot, { width }, keyboardFocus && { borderColor: focusRing, borderWidth: 3 }]}
    />
  );
}

export function PillBar() {
  const { material } = useTheme();
  const bar = usePillBar();
  const { position, pressScale, hidden, cover, width, selected, seeThrough } = bar;
  const { wide, narrow } = pillSlots(width, bar.items.length);
  const lift = useAnimatedStyle(() => ({ opacity: 1 - hidden.get(), transform: [{ translateY: hidden.get() * cover }] }));
  const morph = useAnimatedStyle(() => {
    const travel = Math.sin(Math.PI * (position.get() - Math.floor(position.get())));
    return {
      opacity: Math.min(1, Math.max(0, position.get() + 1)),
      transform: [{ translateX: position.get() * narrow }, { scaleX: 1 + 0.08 * travel - 0.04 * pressScale.get() }, { scaleY: 1 - 0.08 * travel - 0.08 * pressScale.get() }],
    };
  });
  return (
    <Animated.View
      pointerEvents={bar.keyboard ? 'none' : 'box-none'}
      testID="tab-bar"
      style={[styles.wrap, { bottom: bar.bottom, paddingLeft: bar.sideInsets.left, paddingRight: bar.sideInsets.right }, lift]}>
      <View
        accessibilityRole="tablist"
        style={[styles.capsule, { width }, seeThrough ? { backgroundColor: `${material.surfaceContainer}EB`, borderColor: material.outlineVariant, borderWidth: StyleSheet.hairlineWidth } : [styles.raised, { backgroundColor: material.surfaceContainer }]]}
        testID="navigation-bar">
        <View style={styles.track} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.indicator, { width: wide, borderRadius: indicatorRadius, backgroundColor: material.secondaryContainer }, morph]} testID="tab-highlight" />
          {bar.items.map((tab) => (
            <Glyph key={tab.name} tab={tab} bar={bar} material={material} wide={wide} narrow={narrow} />
          ))}
        </View>
        {bar.items.map((tab) => (
          <Slot key={tab.name} tab={tab} width={tab.index === selected ? wide : narrow} focusRing={material.secondary} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  capsule: { height: pillHeight, padding: pillPadding, borderRadius: radius.pill, flexDirection: 'row' },
  raised: { elevation: 3 },
  track: { position: 'absolute', top: pillPadding, left: pillPadding, right: pillPadding, bottom: pillPadding },
  indicator: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  glyph: { position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 24, height: 24 },
  label: { marginLeft: space.sm },
  slot: { height: pillHeight - 2 * pillPadding, borderRadius: radius.pill, overflow: 'hidden' },
  badge: { top: -6, left: 14 },
});
