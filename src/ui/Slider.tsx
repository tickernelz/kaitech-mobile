import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import { useTheme } from '../theme';

const step = 0.05;
const knob = 24;

export function sliderValue(x: number, width: number, max: number): number {
  if (width <= 0) return 0;
  const raw = (Math.min(width, Math.max(0, x)) / width) * max;
  return Math.round(raw / step) * step;
}

export function Slider({ value, max = 1, label, onChange, testID }: { value: number; max?: number; label: string; onChange: (next: number) => void; testID?: string }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const at = (event: GestureResponderEvent) => sliderValue(event.nativeEvent.locationX, width, max);
  const nudge = (delta: number) => onChange(Math.min(max, Math.max(0, Math.round((value + delta) / step) * step)));
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round((value / max) * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => nudge(event.nativeEvent.actionName === 'increment' ? max / 10 : -max / 10)}
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => setDraft(at(event))}
      onResponderMove={(event) => setDraft(at(event))}
      onResponderRelease={(event) => {
        setDraft(null);
        onChange(at(event));
      }}
      onResponderTerminate={() => setDraft(null)}
      style={styles.area}
      testID={testID}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: colors.line }]}>
        <View style={[styles.fill, { width: `${(shown / max) * 100}%`, backgroundColor: colors.primary }]} />
      </View>
      <View pointerEvents="none" style={[styles.knob, { left: Math.max(0, (shown / max) * width - knob / 2), backgroundColor: colors.surface, borderColor: colors.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  area: { height: 44, justifyContent: 'center' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  knob: { position: 'absolute', width: knob, height: knob, borderRadius: knob / 2, borderWidth: 2 },
});
