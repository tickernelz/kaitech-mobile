import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { space, stroke, useTheme } from '../../../theme';
import { Button } from '../../../ui/Button';
import { notify } from '../../../ui/dialog';
import { Icon } from '../../../ui/icons';
import { Pressable } from '../../../ui/Pressable';
import { Text } from '../../../ui/Text';
import { useChat } from '../chat';
import { formatCoordinates, mapsAppUrl, type Point } from '../geo';
import { liveRunning } from '../rich';
import { useChatFormat } from './format';
import { askStop, useNow } from './LocationCard';
import { TileMap } from './TileMap';

export function PlaceScreen({ channelId, messageId }: { channelId: number; messageId: number }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { clock } = useChatFormat();
  const message = useChat((state) => state.threads[channelId]?.messages.find((item) => item.id === messageId) ?? null);
  const partnerId = useChat((state) => state.partnerId);
  const place = message?.rich && 'location' in message.rich ? message.rich.location : null;
  const now = useNow(!!place?.live && !place.ended, place?.liveUntil ?? null);
  const [view, setView] = useState<{ center: Point; zoom: number } | null>(null);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  if (!message || !place) {
    return (
      <SafeAreaView style={[styles.fill, styles.empty, { backgroundColor: colors.canvas }]} testID="place-missing">
        <Text variant="callout" tone="inkSoft">
          {t('act.failed')}
        </Text>
        <Button label={t('composer.closeSheet')} kind="secondary" onPress={close} />
      </SafeAreaView>
    );
  }
  const running = liveRunning(place, now);
  const point = { latitude: place.latitude, longitude: place.longitude };
  const center = view?.center ?? point;
  const zoom = view?.zoom ?? 16;
  const following = view === null;
  const title = place.live ? t('rich.liveLocation') : place.name || t('rich.location');
  const detail = place.live
    ? running && place.liveUntil
      ? [t('location.liveUntil', { time: clock(place.liveUntil) }), place.updatedAt ? t('location.lastSeen', { time: clock(place.updatedAt) }) : null].filter(Boolean).join(' · ')
      : [t('location.liveEnded'), place.updatedAt ? t('location.lastSeen', { time: clock(place.updatedAt) }) : null].filter(Boolean).join(' · ')
    : place.address || formatCoordinates(place);
  const openApp = async () => {
    try {
      await Linking.openURL(mapsAppUrl({ ...point, name: place.name }, Platform.OS));
    } catch {
      notify(t('location.noMapsApp'));
    }
  };
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.canvas }]} edges={['top', 'bottom']} testID="place-screen">
      <View style={styles.bar}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('composer.closeSheet')} onPress={close} hitSlop={8} style={styles.icon} testID="place-close">
          <Icon name="back" color={colors.ink} />
        </Pressable>
        <View style={styles.fill}>
          <Text variant="headline" numberOfLines={1} accessibilityRole="header" style={{ color: colors.ink }}>
            {title}
          </Text>
          <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
            {message.authorId === partnerId ? t('location.you') : message.author}
          </Text>
        </View>
      </View>
      <TileMap
        center={center}
        zoom={zoom}
        onMove={(next, nextZoom) => setView({ center: next, zoom: nextZoom })}
        markers={[{ key: String(message.id), point, kind: place.live ? 'live' : 'pin', ended: place.live && !running }]}
        label={[title, detail].join(', ')}
        style={styles.fill}
        testID="place-map"
        overlay={
          !following ? (
            <Pressable accessibilityRole="button" accessibilityLabel={t('location.openMap')} onPress={() => setView(null)} style={[styles.recenter, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="place-recenter">
              <Icon name="location" size={20} color={colors.ink} />
            </Pressable>
          ) : null
        }
      />
      <View style={[styles.panel, { backgroundColor: colors.surface, borderTopColor: colors.line }]}>
        <Text variant="callout" style={[styles.bold, { color: colors.ink }]}>
          {place.live ? title : place.name || t('location.unknownPlace')}
        </Text>
        <Text variant="footnote" tone="inkSoft" testID="place-detail">
          {detail}
        </Text>
        <View style={styles.actions}>
          <Button label={t('location.openApp')} kind="secondary" onPress={() => void openApp()} style={styles.fill} testID="place-open-app" />
          {running && message.authorId === partnerId ? <Button label={t('location.stop')} kind="danger" onPress={() => void askStop(message.id, t)} style={styles.fill} testID="place-stop" /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.lg },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.sm },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  recenter: { position: 'absolute', right: 8, bottom: 32, width: 44, height: 44, borderRadius: 22, borderWidth: stroke.thin, alignItems: 'center', justifyContent: 'center' },
  panel: { borderTopWidth: stroke.hairline, padding: space.lg, gap: space.xs },
  bold: { fontWeight: '600' },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
});
