import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePendingActivities } from '../features/activity/useActivityOverview';
import { radius, space, useTheme } from '../theme';
import { duration, easing, spring } from '../theme/motion';
import { useReduceMotion } from '../theme/reduceMotion';
import { Icon } from '../ui/icons';
import { Pressable } from '../ui/Pressable';
import { Text } from '../ui/Text';
import { glyphLeft, labelRoom, openness, pillCover, pillHeight, pillPadding, pillSlots, pillWidth } from './tabBar';
import { badgeText, tabIcons, tabs, type TabName } from './tabs';
import { useTab } from './useTab';

type Ink = { highlight: string; active: string; idle: string; badge: string; onBadge: string };

type Motion = { position: SharedValue<number>; pressed: SharedValue<number>; pressScale: SharedValue<number>; wide: number; narrow: number; still: boolean };

function tick() {
  const done = Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key) : Haptics.selectionAsync();
  void done.catch(() => undefined);
}

function Badge({ ink }: { ink: Ink }) {
  const count = usePendingActivities();
  const text = badgeText(count);
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const shown = useRef(text);
  useEffect(() => {
    const before = shown.current;
    shown.current = text;
    if (!text || text === before || reduceMotion) return;
    scale.set(before ? 1.25 : 0.4);
    scale.set(withSpring(1, spring.spatialFast));
  }, [text, reduceMotion, scale]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  if (!text) return null;
  return (
    <Animated.View style={[styles.badge, { backgroundColor: ink.badge }, pop]} testID="tab-badge-activity">
      <Text variant="label" maxFontSizeMultiplier={1.2} style={[styles.badgeText, { color: ink.onBadge }]}>
        {text}
      </Text>
    </Animated.View>
  );
}

function Glyph({ name, index, ink, motion }: { name: TabName; index: number; ink: Ink; motion: Motion }) {
  const { t } = useTranslation();
  const label = useSharedValue(0);
  const { position, pressed, pressScale, wide, narrow } = motion;
  const place = useAnimatedStyle(() => {
    const squeeze = pressed.get() === index ? 1 - 0.08 * pressScale.get() : 1;
    return { transform: [{ translateX: glyphLeft(index, position.get(), wide, narrow, label.get()) }, { scale: squeeze }] };
  });
  const fill = useAnimatedStyle(() => ({ opacity: openness(index, position.get()) }));
  const line = useAnimatedStyle(() => ({ opacity: 1 - openness(index, position.get()) }));
  const words = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, (openness(index, position.get()) - 0.5) * 2)) }));
  return (
    <Animated.View style={[styles.glyph, place]}>
      <View style={styles.icon}>
        <Animated.View style={[StyleSheet.absoluteFill, line]}>
          <Icon name={tabIcons[name]} color={ink.idle} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, fill]}>
          <Icon name={tabIcons[name]} color={ink.active} variant="fill" />
        </Animated.View>
        {name === 'activity' ? <Badge ink={ink} /> : null}
      </View>
      <Animated.View style={words}>
        <Text
          variant="label"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
          onLayout={(event) => {
            label.set(event.nativeEvent.layout.width);
          }}
          style={[styles.label, { color: ink.active, maxWidth: labelRoom(wide) }]}
          testID={`tab-label-${name}`}>
          {t(`tabs.${name}`)}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

function Slot({ name, index, width, motion, tab }: { name: TabName; index: number; width: number; motion: Motion; tab: ReturnType<typeof useTab> }) {
  const { t } = useTranslation();
  const { material } = useTheme();
  const { focused, open } = tab;
  const count = usePendingActivities();
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const pending = name === 'activity' && badgeText(count) ? `, ${t('activities.pending', { count })}` : '';
  return (
    <Pressable
      onPress={() => {
        if (open()) tick();
      }}
      onPressIn={() => {
        if (motion.still) return;
        motion.pressed.set(index);
        motion.pressScale.set(withSpring(1, spring.effectsFast));
      }}
      onPressOut={() => {
        if (motion.still) return;
        motion.pressScale.set(withSpring(0, spring.effects));
      }}
      onFocus={() => setKeyboardFocus(true)}
      onBlur={() => setKeyboardFocus(false)}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={`${t(`tabs.${name}`)}${pending}`}
      testID={`tab-button-${name}`}
      style={[styles.slot, { width }, keyboardFocus && { borderColor: material.secondary, borderWidth: 3 }]}
    />
  );
}

export function PillBar() {
  const byName: Record<TabName, ReturnType<typeof useTab>> = { chat: useTab('chat'), discovery: useTab('discovery'), mom: useTab('mom'), activity: useTab('activity') };
  const selected = tabs.findIndex((name) => byName[name].focused);
  const { colors, material, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const keyboard = useKeyboardState((state) => state.isVisible);
  const width = pillWidth(window.width, insets.left + insets.right);
  const { wide, narrow } = pillSlots(width, tabs.length);
  const position = useSharedValue(selected);
  const pressed = useSharedValue(-1);
  const pressScale = useSharedValue(0);
  const hidden = useSharedValue(keyboard ? 1 : 0);
  useEffect(() => {
    position.set(reduceMotion ? selected : withSpring(selected, spring.spatial));
  }, [selected, reduceMotion, position]);
  useEffect(() => {
    const target = keyboard ? 1 : 0;
    hidden.set(reduceMotion ? target : withTiming(target, { duration: keyboard ? duration.quick : duration.base, easing: keyboard ? easing.exit : easing.standard }));
  }, [keyboard, reduceMotion, hidden]);
  const cover = pillCover(insets.bottom);
  const lift = useAnimatedStyle(() => ({ opacity: 1 - hidden.get(), transform: [{ translateY: hidden.get() * cover }] }));
  const glide = useAnimatedStyle(() => {
    const between = position.get() - Math.floor(position.get());
    return { opacity: Math.min(1, Math.max(0, position.get() + 1)), transform: [{ translateX: position.get() * narrow }, { scaleX: 1 + 0.06 * Math.sin(Math.PI * between) }] };
  });
  const ios = Platform.OS === 'ios';
  const ink: Ink = {
    highlight: ios ? colors.primary : material.secondaryContainer,
    active: ios ? colors.onPrimary : material.onSecondaryContainer,
    idle: material.onSurfaceVariant,
    badge: material.error,
    onBadge: material.onError,
  };
  const motion: Motion = { position, pressed, pressScale, wide, narrow, still: reduceMotion };
  const lifted = scheme === 'light' ? styles.shadowLight : styles.shadowDark;
  return (
    <Animated.View pointerEvents={keyboard ? 'none' : 'box-none'} testID="tab-bar" style={[styles.wrap, { bottom: insets.bottom + space.sm, paddingLeft: insets.left, paddingRight: insets.right }, lift]}>
      <View
        accessibilityRole="tablist"
        style={[styles.capsule, lifted, { width, backgroundColor: material.surfaceContainer, borderColor: material.outlineVariant }]}
        testID="navigation-bar">
        <View style={styles.track} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.highlight, { width: wide, backgroundColor: ink.highlight }, glide]} testID="tab-highlight" />
          {tabs.map((name, index) => (
            <Glyph key={name} name={name} index={index} ink={ink} motion={motion} />
          ))}
        </View>
        {tabs.map((name, index) => (
          <Slot key={name} name={name} index={index} width={index === selected ? wide : narrow} motion={motion} tab={byName[name]} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  capsule: { height: pillHeight, padding: pillPadding, borderRadius: radius.pill, flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth },
  shadowLight: { elevation: 3, shadowColor: '#000000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  shadowDark: { elevation: 3, shadowColor: '#000000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  track: { position: 'absolute', top: pillPadding, left: pillPadding, right: pillPadding, bottom: pillPadding },
  highlight: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: radius.pill },
  glyph: { position: 'absolute', top: 0, bottom: 0, left: 0, flexDirection: 'row', alignItems: 'center' },
  icon: { width: 24, height: 24 },
  label: { marginLeft: space.sm },
  slot: { height: pillHeight - 2 * pillPadding, borderRadius: radius.pill, overflow: 'hidden' },
  badge: { position: 'absolute', top: -6, left: 14, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, lineHeight: 12 },
});
