import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { Icon } from '../chat/ui/icons';
import { onRealtimeNotifications } from '../chat/chat';
import { onNotification, setCallSurface, startAccount, stopAccount, useCallState } from './call';
import { IncomingCall } from './ui/IncomingCall';
import type { Account } from '../../auth/oauth';

export function CallRuntime({ account }: { account: Account | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const call = useCallState();

  useEffect(() => {
    if (!account) {
      stopAccount();
      return;
    }
    startAccount(account);
    return () => stopAccount();
  }, [account]);

  useEffect(() => onRealtimeNotifications((notification) => onNotification(notification.type, notification.payload)), []);

  const onCallScreen = pathname.startsWith('/call/');
  const surface = call.phase === 'incoming' || onCallScreen;
  const seen = useRef(false);
  useEffect(() => {
    if (!surface && !seen.current) return;
    seen.current = true;
    setCallSurface(surface);
  }, [surface]);

  const answering = call.phase === 'incoming' && call.answering;
  useEffect(() => {
    if (answering && !onCallScreen) router.push({ pathname: '/call/[id]', params: { id: String(call.channelId) } });
  }, [answering, onCallScreen, call.channelId, router]);

  if (call.phase === 'incoming') return <IncomingCall />;

  const inCall = call.phase === 'active' || call.phase === 'reconnecting' || call.phase === 'connecting';
  if (!inCall || pathname.startsWith('/call/')) return null;

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/call/[id]', params: { id: String(call.channelId) } })} style={[styles.banner, { backgroundColor: colors.primary }]} testID="call-banner">
      <Icon name={call.video ? 'camera' : 'mic'} size={18} color={colors.onPrimary} />
      <View style={styles.flex}>
        <Text variant="callout" numberOfLines={1} style={{ color: colors.onPrimary }}>
          {call.channelName || call.callerName}
        </Text>
        <Text variant="label" numberOfLines={1} style={{ color: colors.onPrimary, opacity: 0.8 }}>
          {t('backToCall')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: space.md, right: space.md, bottom: space.md, borderRadius: 16, padding: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, zIndex: 30, elevation: 30 },
  flex: { flex: 1 },
});
