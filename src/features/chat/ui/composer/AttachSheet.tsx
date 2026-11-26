import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { radius, space, useTheme } from '../../../../theme';
import { duration, easing } from '../../../../theme/motion';
import { Icon, type IconName } from '../../../../ui/icons';
import { useBottomInset } from '../../../../ui/insets';
import { useLargeText } from '../../../../layout/windowClass';
import { Overlay } from '../../../../ui/Overlay';
import { Pressable } from '../../../../ui/Pressable';
import { SheetItem } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { attachSources, type AttachSource } from '../attach';

export type Extra = { key: string; icon: IconName; label: string; detail?: string; disabled?: boolean; onPress: () => void };

const sourceIcons: Record<AttachSource, IconName> = { photos: 'image', camera: 'camera', files: 'file', audio: 'audioFile' };

export function AttachSheet({ visible, onClose, onPick, extras = [] }: { visible: boolean; onClose: () => void; onPick: (source: AttachSource) => void; extras?: Extra[] }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const bottomInset = useBottomInset(space.lg);
  const { height } = useWindowDimensions();
  const largeText = useLargeText();
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const shown = useSharedValue(0);
  if (visible && !mounted) setMounted(true);
  useEffect(() => {
    if (visible) {
      shown.set(reduce ? withTiming(1, { duration: duration.quick }) : withTiming(1, { duration: duration.hero, easing: easing.expo }));
      return;
    }
    shown.set(
      withTiming(0, { duration: reduce ? duration.quick : duration.base, easing: easing.exit }, (done) => {
        if (done) scheduleOnRN(setMounted, false);
      }),
    );
  }, [reduce, shown, visible]);
  const scrim = useAnimatedStyle(() => ({ opacity: Math.min(1, shown.get() * 1.8) }));
  const sheet = useAnimatedStyle(() => (reduce ? { opacity: shown.get() } : { transform: [{ translateY: (1 - shown.get()) * height }] }));
  return (
    <Overlay visible={mounted} transparent animationType="none" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }, scrim]}>
          <Pressable style={styles.fill} onPress={onClose} accessibilityLabel={t('composer.closeSheet')} accessibilityRole="button" />
        </Animated.View>
        <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: bottomInset }, sheet]} accessibilityViewIsModal testID="attach-sheet">
          <View style={[styles.handle, { backgroundColor: colors.lineStrong }]} />
          <View style={styles.grid}>
            {attachSources.map((source) => {
              const icon = sourceIcons[source];
              return (
                <Pressable key={source} accessibilityRole="button" accessibilityLabel={t(`composer.source.${source}`)} onPress={() => onPick(source)} style={[styles.item, largeText && styles.itemWide]} testID={`attach-${source}`}>
                  <View style={[styles.circle, { backgroundColor: colors.surface2 }]}>
                    <Icon name={icon} color={colors.ink} />
                  </View>
                  <Text variant="footnote" style={styles.center} numberOfLines={1}>
                    {t(`composer.source.${source}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {extras.length ? <View style={[styles.divider, { backgroundColor: colors.line }]} /> : null}
          {extras.map((extra) => (
            <SheetItem key={extra.key} icon={extra.icon} label={extra.label} detail={extra.detail} disabled={extra.disabled} onPress={extra.onPress} testID={`extra-${extra.key}`} />
          ))}
          <Text variant="label" tone="inkFaint" style={styles.note}>
            {t('composer.pickerNote')}
          </Text>
        </Animated.View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  fill: { flex: 1 },
  sheet: { width: '100%', maxWidth: 560, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: radius.pill, marginBottom: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.lg },
  item: { width: '25%', alignItems: 'center', gap: space.xs, minHeight: 84 },
  itemWide: { width: '50%' },
  circle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: space.xs },
  note: { paddingTop: space.xs },
});
