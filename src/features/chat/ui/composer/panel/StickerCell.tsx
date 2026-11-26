import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, useTheme } from '../../../../../theme';
import { Pressable } from '../../../../../ui/Pressable';
import { mediaSource } from '../../../rich';
import type { GifMedia, Sticker } from '../../../types';
import { useCookie } from '../../useCookie';

export const holdMs = 420;

export function stickerSource(sticker: Sticker, origin: string, animated: boolean, cookie: Record<string, string> | null) {
  return mediaSource(origin, animated ? sticker.url : sticker.poster, cookie);
}

export function gifStill(gif: GifMedia) {
  return gif.preview ?? gif.gif ?? gif.mp4;
}

export const StickerCell = memo(function StickerCell({
  sticker,
  origin,
  size,
  playing = false,
  onPress,
  onLongPress,
  testID,
}: {
  sticker: Sticker;
  origin: string;
  size?: number;
  playing?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  testID?: string;
}) {
  const cookie = useCookie();
  const own = sticker.source === 'pack';
  const animated = playing && sticker.animated;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={sticker.alt} onPress={onPress} onLongPress={onLongPress} delayLongPress={holdMs} style={[styles.sticker, size ? { width: size, height: size } : styles.fill]} testID={testID}>
      <Image
        source={stickerSource(sticker, origin, animated, cookie)}
        recyclingKey={`${sticker.source}-${sticker.id}`}
        autoplay={animated}
        cachePolicy={own ? 'disk' : 'memory'}
        contentFit="contain"
        style={styles.fill}
        accessible={false}
      />
    </Pressable>
  );
});

export const GifCell = memo(function GifCell({ gif, width, playing, label, onPress, onLongPress, testID }: { gif: GifMedia; width: number; playing: boolean; label: string; onPress: () => void; onLongPress?: () => void; testID?: string }) {
  const { colors } = useTheme();
  const still = gifStill(gif);
  const ratio = still ? still.height / still.width : 1;
  const source = mediaSource('', (playing && gif.gif ? gif.gif : still)?.url, null);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={gif.title || label} onPress={onPress} onLongPress={onLongPress} delayLongPress={holdMs} style={styles.gifCell} testID={testID}>
      <View style={[styles.gif, { height: Math.round(width * ratio), backgroundColor: colors.surface2 }]}>
        {source ? <Image source={source} recyclingKey={gif.id} autoplay={playing} cachePolicy="memory" contentFit="cover" style={styles.fill} accessible={false} /> : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  fill: { flex: 1, width: '100%', height: '100%' },
  sticker: { aspectRatio: 1, padding: 6, alignItems: 'center', justifyContent: 'center' },
  gifCell: { padding: 2 },
  gif: { width: '100%', borderRadius: 10, overflow: 'hidden' },
  round: { borderRadius: radius.md },
});
