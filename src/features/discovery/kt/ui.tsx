import { Component, type ReactNode, useCallback, useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { radius, space, useTheme, type Colors, type Scheme } from '../../../theme';
import { Icon, type IconName } from '../../../ui/icons';
import { Text } from '../../../ui/Text';
import type { Tone } from './read';

export const series = [
  ['#7955A0', '#BB99E3'],
  ['#007D7E', '#3FC0C0'],
  ['#286CAB', '#73B0EE'],
  ['#A24852', '#E88D94'],
  ['#905D00', '#D3A056'],
  ['#357A3A', '#7DBD7F'],
] as const;

export function seriesColor(index: number, scheme: Scheme): string {
  return series[index % series.length][scheme === 'dark' ? 1 : 0];
}

export function toneColors(tone: Tone | null, colors: Colors): { solid: string; ink: string; band: string } {
  switch (tone) {
    case 'good':
      return { solid: colors.ok, ink: colors.okInk, band: colors.okBand };
    case 'warn':
      return { solid: colors.warnInk, ink: colors.warnInk, band: colors.warnBand };
    case 'bad':
      return { solid: colors.danger, ink: colors.dangerInk, band: colors.dangerBand };
    case 'info':
      return { solid: colors.infoInk, ink: colors.infoInk, band: colors.infoBand };
    default:
      return { solid: colors.edge, ink: colors.inkSoft, band: colors.surface2 };
  }
}

export function useWidth(): [number, (event: LayoutChangeEvent) => void] {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = Math.floor(event.nativeEvent.layout.width);
    setWidth((previous) => (previous === next ? previous : next));
  }, []);
  return [width, onLayout];
}

export function BlockTitle({ title, count }: { title: string; count?: string }) {
  if (!title && !count) return null;
  return (
    <View style={styles.titleLine}>
      {title ? (
        <Text variant="headline" style={styles.title} selectable>
          {title}
        </Text>
      ) : (
        <View style={styles.grow} />
      )}
      {count ? (
        <Text variant="footnote" tone="inkSoft">
          {count}
        </Text>
      ) : null}
    </View>
  );
}

export function Tool({
  icon,
  label,
  onPress,
  on = false,
  disabled = false,
  hideLabel = false,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  on?: boolean;
  disabled?: boolean;
  hideLabel?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: on }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.tool,
        { borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.select : pressed ? colors.surface2 : colors.surface, opacity: disabled ? 0.5 : 1 },
      ]}>
      <Icon name={icon} size={16} color={on ? colors.selectInk : colors.inkSoft} />
      {hideLabel ? null : (
        <Text variant="label" tone={on ? 'selectInk' : 'inkSoft'}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Status({ tone, text }: { tone: Tone | null; text: string }) {
  const { colors } = useTheme();
  const paint = toneColors(tone, colors);
  return (
    <View style={[styles.status, { backgroundColor: paint.band }]}>
      <View style={[styles.dot, { backgroundColor: paint.solid }]} />
      <Text variant="footnote" style={{ color: paint.ink }}>
        {text}
      </Text>
    </View>
  );
}

export function Meter({ share, tone, label, max, now }: { share: number; tone: Tone | null; label: string; max: number; now: number }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now }}
      style={[styles.meter, { backgroundColor: colors.surface2 }]}>
      <View style={[styles.meterFill, { width: `${Math.max(0, Math.min(100, share))}%`, backgroundColor: toneColors(tone ?? 'info', colors).solid }]} />
    </View>
  );
}

export class DrawGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export const styles = StyleSheet.create({
  titleLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space.sm, rowGap: 2 },
  title: { flexGrow: 1, flexShrink: 1, flexBasis: '60%' },
  grow: { flex: 1 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tool: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: space.xs, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md },
  status: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.xs, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  meter: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  meterFill: { height: 8, borderRadius: radius.pill },
  gap: { gap: space.sm },
});
