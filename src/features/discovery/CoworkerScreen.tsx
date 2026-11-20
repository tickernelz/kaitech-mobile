import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { useTheme } from '../../theme';
import { programmes } from './api';
import { CoworkerThread } from './CoworkerThread';
import { Header } from './Header';
import { openConversation, useOpenConversation } from './store';
import { IconButton } from './ui';
import { useLatestConversation } from './useLatestConversation';

export function CoworkerScreen({
  programme,
  conversation,
  card,
  prefill,
  ask = false,
}: {
  programme: number;
  conversation?: number;
  card?: number;
  prefill?: string;
  ask?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const account = active?.id ?? '';
  const list = useResource('discovery.programmes', programmes, 60_000);
  const name = list.data?.find((row) => row.id === programme)?.name ?? '';
  const open = useOpenConversation(account, programme);
  const { height } = useWindowDimensions();
  const keyboardHeight = useKeyboardState((state) => (state.isVisible ? state.height : 0));
  const roomy = height - keyboardHeight >= minRoomWithHeader;

  useEffect(() => {
    if (!account) return;
    if (conversation) openConversation(account, programme, conversation);
    else if (prefill) openConversation(account, programme, null);
  }, [account, programme, conversation, prefill]);
  useLatestConversation(conversation || prefill ? 0 : programme);

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="coworker-screen">
      {roomy ? (
      <Header
        title={t('discovery.thread.title')}
        subtitle={name}
        actions={
          <>
            <IconButton
              icon="history"
              label={t('discovery.home.conversations')}
              onPress={() => router.push(`/program/${programme}/conversations`)}
              testID="coworker-history"
            />
            <IconButton
              icon="sparkle"
              label={t('discovery.thread.new')}
              onPress={() => openConversation(account, programme, null)}
              testID="coworker-new"
            />
          </>
        }
      />
      ) : null}
      <CoworkerThread key={`${programme}-${open ?? 'new'}`} programme={programme} focusCard={card} focusInput={ask || prefill ? 1 : 0} prefill={prefill} />
    </SafeAreaView>
  );
}

const minRoomWithHeader = 240;

const styles = StyleSheet.create({ fill: { flex: 1 } });
