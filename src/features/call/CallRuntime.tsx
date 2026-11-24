import { usePathname, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { Icon } from '../../ui/icons';
import { onRealtimeNotifications } from '../chat/chat';
import { onNotification, setCallSurface, startAccount, stopAccount, useCallState } from './call';
import { useElapsed } from './clock';
import { IncomingCall } from './ui/IncomingCall';
import type { Account } from '../../auth/oauth';

export function CallRuntime({ account }: { account: Account | null }) {
  const router = useRouter();
  const pathname = usePathname();
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
  return null;
}

export const callStripHeight = 32;

export function CallStrip() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const call = useCallState();
  const inCall = call.phase === 'active' || call.phase === 'reconnecting' || call.phase === 'connecting';
  const shown = inCall && !pathname.startsWith('/call/');
  const elapsed = useElapsed(call.startedAt, shown && call.phase === 'active');
  if (!shown) return null;
  const name = call.channelName || call.callerName;
  const status = call.phase === 'active' ? elapsed : call.phase === 'reconnecting' ? t('reconnecting') : t('connecting');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('backToCall')}, ${name}`}
      onPress={() => router.push({ pathname: '/call/[id]', params: { id: String(call.channelId) } })}
      style={[styles.strip, { height: insets.top + callStripHeight, paddingTop: insets.top, paddingLeft: insets.left + space.lg, paddingRight: insets.right + space.lg, backgroundColor: colors.okBand }]}
      testID="call-banner">
      <Icon name="phone" size={16} color={colors.okInk} variant="fill" />
      {call.muted ? <Icon name="micOff" size={16} color={colors.okInk} /> : null}
      <Text variant="label" numberOfLines={1} style={[styles.text, { color: colors.okInk }]}>
        {status ? `${name} · ${status}` : name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  text: { flexShrink: 1 },
});
