import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useChat } from '../chat/chat';
import { backgroundFor, useChatAppearance, type Background, type Scope } from './appearance';
import { useDevicePhoto, useDim } from './devicePhoto';
import { defaultWallpaperId, isWallpaperId, Wallpaper } from './wallpapers';

export const BackgroundPaint = memo(function BackgroundPaint({ background, scope, accountId }: { background: Background; scope: Scope; accountId: string | null }) {
  const photo = useDevicePhoto(accountId, scope);
  const dim = useDim(accountId);
  const paint =
    background.kind === 'color' ? (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: background.value }]} testID={`background-color-${background.value}`} />
    ) : background.kind === 'device' && photo ? (
      <Image source={{ uri: photo }} resizeMode="cover" resizeMethod="resize" fadeDuration={0} style={StyleSheet.absoluteFill} testID="background-device" />
    ) : (
      <Wallpaper id={background.kind === 'preset' && isWallpaperId(background.value) ? background.value : defaultWallpaperId} />
    );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {paint}
      {dim > 0 ? <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: dim }]} testID="background-dim" /> : null}
    </View>
  );
});

export function ChatBackground({ channelId }: { channelId: number }) {
  const accountId = useChat((state) => state.accountId);
  const { background, scope } = backgroundFor(useChatAppearance(accountId), channelId);
  return <BackgroundPaint background={background} scope={scope} accountId={accountId} />;
}
