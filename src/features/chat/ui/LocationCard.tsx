import { Image } from 'expo-image';
import { touchTarget } from '../../../ui/touch';
import { router } from 'expo-router';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../../theme';
import { confirm, notify } from '../../../ui/dialog';
import { Icon } from '../../../ui/icons';
import { Pressable } from '../../../ui/Pressable';
import { Text } from '../../../ui/Text';
import { chatClient, useChat } from '../chat';
import { formatCoordinates } from '../geo';
import { stopShare } from '../live';
import { liveRunning, mediaSource } from '../rich';
import type { Message, Place } from '../types';
import { useChatFormat } from './format';
import { useCookie } from './useCookie';

export const locationWidth = 264;
const mapHeight = 148;

export function useNow(running: boolean, until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running || until === null) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(1000, Math.min(60000, until - Date.now() + 500)));
    return () => clearTimeout(timer);
  }, [running, until, now]);
  return now;
}

export function staticMapUrl(place: Place, messageId: number): string {
  const base = place.map ?? `/kaitech_chat/location/${messageId}/map?seq=${place.seq}`;
  return `${base}${base.includes('?') ? '&' : '?'}size=s`;
}

export async function askStop(messageId: number, t: (key: 'location.stopTitle' | 'location.stopBody' | 'location.stop' | 'location.keepSharing' | 'location.stopFailed') => string) {
  const go = await confirm({ title: t('location.stopTitle'), body: t('location.stopBody'), confirm: t('location.stop'), cancel: t('location.keepSharing'), danger: true, icon: 'location', testID: 'live-stop-dialog' });
  const account = chatClient()?.account;
  if (!go || !account) return;
  if (!(await stopShare(account, messageId))) notify(t('location.stopFailed'));
}

export const LocationCard = memo(function LocationCard({ message, place, mine, pending = false, onLongPress }: { message: Pick<Message, 'id' | 'channelId'>; place: Place; mine: boolean; pending?: boolean; onLongPress?: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { clock } = useChatFormat();
  const origin = useChat((state) => state.origin);
  const cookie = useCookie();
  const now = useNow(place.live && !place.ended, place.liveUntil);
  const running = liveRunning(place, now);
  const ended = place.live && !running;
  const source = pending ? null : mediaSource(origin, staticMapUrl(place, message.id), cookie);
  const title = place.live ? t('rich.liveLocation') : place.name || t('rich.location');
  const detail = place.live
    ? running && place.liveUntil
      ? t('location.liveUntil', { time: clock(place.liveUntil) })
      : [t('location.liveEnded'), place.endReason ? t(`location.endedBy.${place.endReason}`) : null].filter(Boolean).join(' · ')
    : place.address || formatCoordinates(place);
  const open = () => router.push({ pathname: '/place', params: { channel: String(message.channelId), message: String(message.id) } });
  return (
    <View style={styles.card} testID={`location-${message.id}`}>
      <Pressable accessibilityRole="button" accessibilityLabel={[title, detail, t('location.openMap')].join(', ')} onPress={open} onLongPress={onLongPress} delayLongPress={300} disabled={pending} style={[styles.map, { backgroundColor: colors.surface2 }]} testID={`location-${message.id}-map`}>
        {source ? (
          <Image source={source} recyclingKey={`location-${message.id}`} placeholderContentFit="cover" cachePolicy="disk" transition={200} contentFit="cover" style={[styles.map, ended && styles.faded]} accessible={false} />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="location" size={32} color={colors.inkFaint} />
          </View>
        )}
      </Pressable>
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: running ? colors.okBand : colors.surface2 }]}>
          <Icon name={place.live ? 'compass' : 'location'} size={18} color={running ? colors.okInk : colors.inkSoft} />
        </View>
        <View style={styles.text}>
          <Text variant="callout" style={[styles.bold, { color: colors.ink }]} numberOfLines={1}>
            {title}
          </Text>
          <Text variant="footnote" tone="inkSoft" numberOfLines={2} testID={`location-${message.id}-detail`}>
            {detail}
          </Text>
        </View>
      </View>
      {mine && running && !pending ? (
        <Pressable accessibilityRole="button" onPress={() => void askStop(message.id, t)} style={[styles.stop, { borderColor: colors.line }]} testID={`location-${message.id}-stop`}>
          <Icon name="stop" size={16} color={colors.dangerInk} />
          <Text variant="footnote" tone="dangerInk">
            {t('location.stop')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: locationWidth, gap: space.sm },
  map: { width: locationWidth, height: mapHeight, borderRadius: radius.md, overflow: 'hidden' },
  faded: { opacity: 0.6 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  bold: { fontWeight: '600' },
  stop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, minHeight: touchTarget, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
});
