import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { readableWidth } from '../../layout/windowClass';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Divider, Row } from '../../ui/List';
import { parseServerDate } from './dates';
import { Header } from './Header';
import { openConversation, useOpenConversation } from './store';
import { StateView } from './ui';
import { useLatestConversation } from './useLatestConversation';

export function ConversationsScreen({ programme }: { programme: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { date } = useFormatters();
  const { active } = useSession();
  const account = active?.id ?? '';
  const list = useLatestConversation(programme);
  const open = useOpenConversation(account, programme);
  const choose = (conversation: number | null) => {
    openConversation(account, programme, conversation);
    router.back();
  };
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="conversations">
      <Header title={t('discovery.home.conversations')} />
      <View style={styles.action}>
        <Button kind="secondary" label={t('discovery.thread.new')} onPress={() => choose(null)} testID="conversation-new" />
      </View>
      <FlatList
        style={styles.list}
        data={list.data ?? []}
        keyExtractor={(row) => String(row.id)}
        ItemSeparatorComponent={Divider}
        renderItem={({ item }) => {
          const at = parseServerDate(item.last_activity_at);
          return (
            <Row
              title={item.name}
              detail={at ? date(at) : undefined}
              selected={item.id === open}
              onPress={() => choose(item.id)}
              testID={`conversation-${item.id}`}
            />
          );
        }}
        ListEmptyComponent={
          <StateView
            loading={list.loading}
            error={list.error}
            empty={{ title: t('discovery.thread.emptyTitle') }}
            onRetry={() => void list.refresh()}
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  action: { paddingHorizontal: space.lg, paddingBottom: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  list: { width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
