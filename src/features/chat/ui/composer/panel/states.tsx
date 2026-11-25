import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { radius, space, useTheme } from '../../../../../theme';
import { Icon, iconNames, type IconName } from '../../../../../ui/icons';
import { Pressable } from '../../../../../ui/Pressable';
import { Text } from '../../../../../ui/Text';
import type { PanelProblem } from './logic';

const problemIcons: Record<PanelProblem, string> = { offline: 'cloudOff', unavailable: 'gif', server: 'alert', emptySearch: 'search', noStickers: 'sticker' };

export function PanelState({ problem, query, code, admin, onRetry, onSettings }: { problem: PanelProblem; query?: string; code?: string; admin?: boolean; onRetry?: () => void; onSettings?: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const glyph = problemIcons[problem];
  const icon = ((iconNames as string[]).includes(glyph) ? glyph : problem === 'unavailable' ? 'image' : 'alert') as IconName;
  const danger = problem === 'server';
  return (
    <View style={styles.state} accessibilityLiveRegion="polite" testID={`panel-state-${problem}`}>
      <View style={[styles.stateIcon, { backgroundColor: danger ? colors.dangerBand : colors.surface2 }]}>
        <Icon name={icon} size={24} color={danger ? colors.dangerInk : colors.inkSoft} />
      </View>
      <Text variant="headline" style={styles.center}>
        {t(`panel.state.${problem}.title`, { query })}
      </Text>
      <Text variant="callout" tone="inkSoft" style={styles.center}>
        {t(`panel.state.${problem}.body`, { code })}
      </Text>
      {(problem === 'offline' || problem === 'server') && onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.action, { borderColor: colors.line }]} testID="panel-retry">
          <Text variant="callout" tone="link">
            {t('panel.retry')}
          </Text>
        </Pressable>
      ) : null}
      {problem === 'unavailable' && admin && onSettings ? (
        <Pressable accessibilityRole="button" onPress={onSettings} style={[styles.action, { borderColor: colors.line }]} testID="panel-settings">
          <Text variant="callout" tone="link">
            {t('panel.openSettings')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const skeletonHeights = [96, 132, 120, 88, 140, 104, 92, 128];

export function Skeleton() {
  const { colors } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduce) return;
    pulse.set(withRepeat(withSequence(withTiming(0.5, { duration: 600 }), withTiming(1, { duration: 600 })), -1));
  }, [pulse, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return (
    <Animated.View style={[styles.skeleton, style]} testID="panel-skeleton" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1].map((column) => (
        <View key={column} style={styles.column}>
          {skeletonHeights
            .filter((_, index) => index % 2 === column)
            .map((height, index) => (
              <View key={index} style={[styles.bone, { height, backgroundColor: colors.line }]} />
            ))}
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.xl },
  stateIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  action: { minHeight: 44, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  skeleton: { flexDirection: 'row', gap: 4, paddingTop: space.xs },
  column: { flex: 1, gap: 4 },
  bone: { borderRadius: 10 },
});
