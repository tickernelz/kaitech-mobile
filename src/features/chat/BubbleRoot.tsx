import '../../i18n';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '../../auth/session';
import { useLock } from '../../lock/lock';
import { space, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { accountForPush } from '../call/account';
import { startChat } from './chat';
import { ThreadView } from './ui/ThreadView';

export function BubbleRoot({ db, uid, channelId }: { db?: string; uid?: number; channelId?: number }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const session = useSession();
  const lock = useLock();
  const account = accountForPush({ db, uid }, session.accounts);
  const usable = account !== null && session.activeId === account.id && !session.expired && session.onboarded && !lock.enabled;
  const channel = Number(channelId);

  useEffect(() => {
    if (usable && account) startChat(account);
  }, [usable, account]);

  return (
    <SafeAreaProvider>
      <KeyboardProvider>
        {usable && Number.isInteger(channel) && channel > 0 ? (
          <ThreadView channelId={channel} twoPane={false} bubble onOpenChannel={() => undefined} />
        ) : (
          <View style={[styles.closed, { backgroundColor: colors.canvas }]}>
            <Text variant="callout" tone="inkSoft" style={styles.center}>
              {t('notify.bubbleClosed')}
            </Text>
          </View>
        )}
      </KeyboardProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  closed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  center: { textAlign: 'center' },
});
