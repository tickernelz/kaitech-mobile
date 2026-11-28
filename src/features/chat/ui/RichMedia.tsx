import type { TFunction } from 'i18next';
import { Image } from 'expo-image';
import { setVideoCacheSizeAsync, useVideoPlayer, VideoView } from 'expo-video';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../../theme';
import { useReduceMotion } from '../../../theme/reduceMotion';
import { Text } from '../../../ui/Text';
import { mediaSource, richMedia, richSize, richText } from '../rich';
import type { GifMedia, Media, MediaRich, Rich, Sticker } from '../types';
import { useCookie } from './useCookie';
import { useOnScreen } from './visible';

export const videoCacheBytes = 100 * 1024 * 1024;

try {
  void setVideoCacheSizeAsync(videoCacheBytes).catch(() => undefined);
} catch {}

export const stickerBox = 144;
export const gifBox = 220;

export function richLabel(t: TFunction<'chat'>, rich: Rich): string {
  return richText(rich, (key) => t(key));
}

export const RichMedia = memo(function RichMedia({ rich, origin, messageId = null, testID }: { rich: MediaRich; origin: string; messageId?: number | null; testID?: string }) {
  const { t } = useTranslation('chat');
  const reduce = useReduceMotion();
  const onScreen = useOnScreen(messageId);
  const playing = onScreen && !reduce;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={richLabel(t, rich)} testID={testID}>
      {'sticker' in rich ? <StickerView sticker={rich.sticker} origin={origin} playing={playing} /> : <GifView gif={rich.gif} playing={playing} />}
    </View>
  );
});

function StickerView({ sticker, origin, playing }: { sticker: Sticker; origin: string; playing: boolean }) {
  const cookie = useCookie();
  const box = richSize(sticker, stickerBox);
  const animated = playing && sticker.animated;
  const source = mediaSource(origin, animated ? sticker.url : sticker.poster, cookie);
  return source ? <Image source={source} recyclingKey={`${sticker.source}-${sticker.id}-${animated}`} autoplay={animated} cachePolicy="disk" contentFit="contain" style={box} accessible={false} /> : <View style={box} />;
}

function GifView({ gif, playing }: { gif: GifMedia; playing: boolean }) {
  const { colors } = useTheme();
  const media = richMedia({ gif });
  const box = richSize(media, gifBox);
  const still = mediaSource('', (gif.preview ?? gif.gif ?? gif.mp4)?.url, null);
  const video = playing && gif.mp4 ? mediaSource('', gif.mp4.url, null) : null;
  const animated = playing && !video && gif.gif ? mediaSource('', gif.gif.url, null) : null;
  return (
    <View style={[box, styles.gif, { backgroundColor: colors.surface2 }]}>
      {animated ? (
        <Image source={animated} recyclingKey={`${gif.id}-gif`} autoplay cachePolicy="disk" contentFit="cover" style={box} accessible={false} />
      ) : still && gif.preview ? (
        <Image source={still} recyclingKey={`${gif.id}-still`} autoplay={false} cachePolicy="disk" contentFit="cover" style={box} accessible={false} />
      ) : null}
      {video ? <GifVideo uri={video.uri} box={box} /> : null}
      <View style={[styles.badge, { backgroundColor: colors.scrim }]}>
        <Text variant="label" style={{ color: colors.onStage }}>
          GIF
        </Text>
      </View>
    </View>
  );
}

function GifVideo({ uri, box }: { uri: string; box: Pick<Media, 'width' | 'height'> }) {
  const player = useVideoPlayer({ uri, useCaching: true }, (created) => {
    created.muted = true;
    created.loop = true;
    created.audioMixingMode = 'mixWithOthers';
    created.play();
  });
  return <VideoView player={player} style={[StyleSheet.absoluteFill, box]} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} surfaceType="textureView" />;
}

const styles = StyleSheet.create({
  gif: { borderRadius: radius.md, overflow: 'hidden' },
  badge: { position: 'absolute', left: space.xs, bottom: space.xs, paddingHorizontal: space.xs, borderRadius: radius.sm },
});
