import type { TFunction } from 'i18next';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { mediaSource, richMedia, richSize } from '../rich';
import type { Rich } from '../types';
import { useCookie } from './useCookie';

export const stickerBox = 144;
export const gifBox = 220;

export function richLabel(t: TFunction<'chat'>, rich: Rich): string {
  return 'sticker' in rich ? [t('rich.sticker'), rich.sticker.alt].filter(Boolean).join(': ') : [t('rich.gif'), rich.gif.title].filter(Boolean).join(': ');
}

export const RichMedia = memo(function RichMedia({ rich, origin, testID }: { rich: Rich; origin: string; testID?: string }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const cookie = useCookie();
  const media = richMedia(rich);
  const sticker = 'sticker' in rich;
  const box = richSize(media, sticker ? stickerBox : gifBox);
  const source = mediaSource(origin, media.url, cookie);
  return (
    <View style={[box, !sticker && [styles.gif, { backgroundColor: colors.surface2 }]]} accessible accessibilityRole="image" accessibilityLabel={richLabel(t, rich)} testID={testID}>
      {source ? <Image source={source} style={box} resizeMode="contain" /> : null}
      {sticker ? null : (
        <View style={[styles.badge, { backgroundColor: colors.scrim }]}>
          <Text variant="label" style={{ color: colors.onPrimary }}>
            GIF
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  gif: { borderRadius: radius.md, overflow: 'hidden' },
  badge: { position: 'absolute', left: space.xs, bottom: space.xs, paddingHorizontal: space.xs, borderRadius: radius.sm },
});
