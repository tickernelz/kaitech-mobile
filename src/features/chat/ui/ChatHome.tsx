import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Panes } from '../../../layout/Panes';
import { useWindowClass } from '../../../layout/windowClass';
import { space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Wordmark } from '../../../ui/Wordmark';
import { focusedMessage, selectChannel, selectedChannel, useSelectedChannel } from '../selection';
import { ConversationList } from './ConversationList';
import { useCan } from '../../../auth/useAccess';
import { DirectorySheet } from './list/DirectorySheet';
import { NewConversationSheet } from './list/NewConversationSheet';
import { ThreadView } from './ThreadView';

function toId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function ChatHome() {
  const { t } = useTranslation(['chat', 'translation']);
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ channel?: string; message?: string }>();
  const { windowClass } = useWindowClass();
  const expanded = windowClass === 'expanded';
  const selected = useSelectedChannel();
  const [creating, setCreating] = useState(false);
  const team = useCan('team');

  const open = useCallback(
    (id: number, message?: number | null) => {
      if (expanded) selectChannel(id, message ?? null);
      else router.push({ pathname: '/chat/[id]', params: { id: String(id), ...(message ? { message: String(message) } : {}) } });
    },
    [expanded, router],
  );

  useEffect(() => {
    const channel = toId(params.channel);
    if (!channel) return;
    open(channel, toId(params.message));
    router.setParams({ channel: undefined, message: undefined });
  }, [params.channel, params.message, open, router]);

  const wasExpanded = useRef(expanded);
  useEffect(() => {
    const current = selectedChannel();
    if (wasExpanded.current && !expanded && current) router.push({ pathname: '/chat/[id]', params: { id: String(current) } });
    wasExpanded.current = expanded;
  }, [expanded, router]);

  const detail = selected ? (
    <ThreadView key={selected} channelId={selected} twoPane focusMessage={focusedMessage()} onOpenChannel={(id) => selectChannel(id)} onBack={() => selectChannel(null)} />
  ) : (
    <View style={[styles.placeholder, { backgroundColor: colors.surface2 }]}>
      <View style={styles.faint} importantForAccessibility="no-hide-descendants">
        <Wordmark width={160} label={t('translation:app.name')} />
      </View>
      <Text variant="callout" tone="inkSoft" style={styles.center}>
        {t('thread.pickOne')}
      </Text>
    </View>
  );

  return (
    <SafeAreaView edges={['right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="tab-chat">
      <Panes list={<ConversationList selectedId={expanded ? selected : null} onOpen={open} onNew={() => setCreating(true)} />} detail={detail} />
      {creating && !team ? (
        <DirectorySheet
          onClose={() => setCreating(false)}
          onOpen={(id) => {
            setCreating(false);
            open(id);
          }}
        />
      ) : null}
      {creating && team ? (
        <NewConversationSheet
          onClose={() => setCreating(false)}
          onOpen={(id) => {
            setCreating(false);
            open(id);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { textAlign: 'center' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  faint: { opacity: 0.25 },
});
