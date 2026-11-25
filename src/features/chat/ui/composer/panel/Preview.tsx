import { Image } from 'expo-image';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { radius, space, useTheme } from '../../../../../theme';
import { duration, easing } from '../../../../../theme/motion';
import { Overlay } from '../../../../../ui/Overlay';
import { Pressable } from '../../../../../ui/Pressable';
import { Text } from '../../../../../ui/Text';
import type { GifMedia, Sticker } from '../../../types';
import { useCookie } from '../../useCookie';
import { gifStill, stickerSource } from './StickerCell';

export type Previewed = { sticker: Sticker } | { gif: GifMedia };

const previewSize = 184;

export function MediaPreview({ item, origin, favorite, onSend, onFavorite, onClose }: { item: Previewed | null; origin: string; favorite?: boolean; onSend: () => void; onFavorite?: () => void; onClose: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const cookie = useCookie();
  const reduce = useReducedMotion();
  const open = useSharedValue(0);
  useEffect(() => {
    if (!item) return;
    open.set(0);
    open.set(reduce ? withTiming(1, { duration: duration.quick }) : withTiming(1, { duration: duration.slow, easing: easing.expo }));
  }, [item, open, reduce]);
  const style = useAnimatedStyle(() => ({ opacity: open.get(), transform: reduce ? [] : [{ scale: 0.6 + 0.4 * open.get() }] }));
  const source = item ? ('sticker' in item ? stickerSource(item.sticker, origin, true, cookie) : { uri: (item.gif.gif ?? gifStill(item.gif))?.url }) : null;
  const own = item && 'sticker' in item && item.sticker.source === 'pack';
  return (
    <Overlay visible={item !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('panel.closePreview')}>
        <Animated.View style={[styles.card, { backgroundColor: colors.surface }, style]} testID="panel-preview">
          {source ? <Image source={source} autoplay cachePolicy={own ? 'disk' : 'memory'} contentFit="contain" style={styles.media} accessible={false} /> : null}
          <View style={styles.actions}>
            {onFavorite ? (
              <Pressable accessibilityRole="button" onPress={onFavorite} style={[styles.button, { borderColor: colors.line }]} testID="panel-preview-favorite">
                <Text variant="callout">{favorite ? t('panel.unfavorite') : t('panel.favorite')}</Text>
              </Pressable>
            ) : null}
            <Pressable accessibilityRole="button" onPress={onSend} style={[styles.button, { backgroundColor: colors.primary, borderColor: colors.primary }]} testID="panel-preview-send">
              <Text variant="callout" style={{ color: colors.onPrimary }}>
                {t('composer.send')}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Pressable>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: radius.sheet, padding: space.lg, gap: space.lg, alignItems: 'center' },
  media: { width: previewSize, height: previewSize },
  actions: { flexDirection: 'row', gap: space.sm },
  button: { minHeight: 44, minWidth: 96, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
