import { Image } from 'expo-image';
import { useLayoutEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { radius, space, useTheme } from '../../../theme';
import { Icon } from '../../../ui/icons';
import { Pressable } from '../../../ui/Pressable';
import { Text } from '../../../ui/Text';
import { useChat } from '../chat';
import { clampZoom, moved, offsetOf, tilePath, tilesFor, tileSize, type Point } from '../geo';
import { mediaSource } from '../rich';
import { useCookie } from './useCookie';

export type MapMarker = { key: string; point: Point; kind: 'self' | 'pin' | 'live'; ended?: boolean };

const markerSize = 40;

export function TileMap({
  center,
  zoom,
  onMove,
  markers = [],
  crosshair = false,
  overlay,
  style,
  label,
  testID,
}: {
  center: Point;
  zoom: number;
  onMove: (center: Point, zoom: number, byUser: boolean) => void;
  markers?: MapMarker[];
  crosshair?: boolean;
  overlay?: ReactNode;
  style?: StyleProp<ViewStyle>;
  label: string;
  testID?: string;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const origin = useChat((state) => state.origin);
  const cookie = useCookie();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const scale = useSharedValue(1);
  const startScale = useSharedValue(1);
  useLayoutEffect(() => {
    x.set(0);
    y.set(0);
    scale.set(1);
  }, [center.latitude, center.longitude, zoom, x, y, scale]);
  const commit = (dx: number, dy: number, factor: number) => {
    const next = clampZoom(zoom + Math.round(Math.log2(factor)));
    onMove(moved(center, zoom, dx, dy), next, true);
  };
  const pan = usePanGesture({
    minDistance: 4,
    onUpdate: (event) => {
      'worklet';
      x.set(event.translationX);
      y.set(event.translationY);
    },
    onDeactivate: () => {
      'worklet';
      scheduleOnRN(commit, x.get() / scale.get(), y.get() / scale.get(), scale.get());
    },
  });
  const pinch = usePinchGesture({
    onBegin: () => {
      'worklet';
      startScale.set(scale.get());
    },
    onUpdate: (event) => {
      'worklet';
      scale.set(Math.min(4, Math.max(0.25, startScale.get() * event.scale)));
    },
  });
  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    maxDistance: 10,
    onDeactivate: (event) => {
      'worklet';
      if (!event.canceled) scheduleOnRN(commit, 0, 0, 2);
    },
  });
  const gesture = useSimultaneousGestures(pan, pinch, doubleTap);
  const layer = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }] }));
  const tiles = tilesFor(center, zoom, size.width, size.height);
  const zoomBy = (step: number) => onMove(center, clampZoom(zoom + step), true);
  return (
    <View style={[styles.frame, { backgroundColor: colors.surface2 }, style]} onLayout={(event) => setSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} testID={testID}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[StyleSheet.absoluteFill, layer]} accessible accessibilityRole="image" accessibilityLabel={label}>
          {tiles.map((tile) => {
            const source = mediaSource(origin, tilePath(tile), cookie);
            return source ? <Image key={tile.key} source={source} recyclingKey={tile.key} cachePolicy="disk" transition={0} style={[styles.tile, { left: tile.left, top: tile.top }]} accessible={false} /> : null;
          })}
          {markers.map((marker) => {
            const at = offsetOf(center, zoom, marker.point);
            return (
              <View key={marker.key} pointerEvents="none" style={[styles.marker, { left: size.width / 2 + at.dx - markerSize / 2, top: size.height / 2 + at.dy - markerSize }]} testID={`map-marker-${marker.key}`}>
                {marker.kind === 'self' ? (
                  <View style={[styles.self, { backgroundColor: colors.infoInk, borderColor: colors.surface }]} />
                ) : (
                  <Icon name="location" size={markerSize} color={marker.ended ? colors.inkFaint : marker.kind === 'live' ? colors.ok : colors.danger} />
                )}
              </View>
            );
          })}
        </Animated.View>
      </GestureDetector>
      {crosshair ? (
        <View pointerEvents="none" style={[styles.marker, { left: size.width / 2 - markerSize / 2, top: size.height / 2 - markerSize }]} testID="map-crosshair">
          <Icon name="location" size={markerSize} color={colors.danger} />
        </View>
      ) : null}
      <View style={styles.zoom}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('location.zoomIn')} onPress={() => zoomBy(1)} style={[styles.zoomButton, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="map-zoom-in">
          <Icon name="zoomIn" size={20} color={colors.ink} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('location.zoomOut')} onPress={() => zoomBy(-1)} style={[styles.zoomButton, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="map-zoom-out">
          <Icon name="zoomOut" size={20} color={colors.ink} />
        </Pressable>
      </View>
      {overlay}
      <Text variant="label" tone="inkSoft" style={[styles.attribution, { backgroundColor: colors.surface }]} accessibilityRole="text">
        {t('location.attribution')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  tile: { position: 'absolute', width: tileSize, height: tileSize },
  marker: { position: 'absolute', width: markerSize, height: markerSize, alignItems: 'center', justifyContent: 'flex-end' },
  self: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, marginBottom: markerSize / 2 - 9 },
  zoom: { position: 'absolute', right: space.sm, top: space.sm, gap: space.xs },
  zoomButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  attribution: { position: 'absolute', right: 0, bottom: 0, paddingHorizontal: space.xs, borderTopLeftRadius: radius.sm, opacity: 0.9 },
});
