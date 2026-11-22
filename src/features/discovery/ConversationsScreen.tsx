import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { update } from '../../api/resource';
import { useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { readableWidth } from '../../layout/windowClass';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { FormSheet } from '../../ui/FormSheet';
import { Divider, Row } from '../../ui/List';
import { RowActions } from '../../ui/RowActions';
import { deferUndoable } from '../../ui/undo';
import { putAwayConversation, renameConversation, type Conversation } from './api';
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
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const choose = (conversation: number | null) => {
    openConversation(account, programme, conversation);
    router.back();
  };
  const change = (next: (rows: Conversation[]) => Conversation[]) => {
    if (list.key) update<Conversation[]>(list.key, (rows) => next(rows ?? []));
  };
  const putAway = (row: Conversation) => {
    const owner = active;
    if (!owner) return;
    const wasOpen = open === row.id;
    deferUndoable({
      label: t(row.turn_count ? 'discovery.rows.archivedDone' : 'discovery.rows.deletedDone'),
      apply: () => change((rows) => rows.filter((item) => item.id !== row.id)),
      revert: () => change((rows) => (rows.some((item) => item.id === row.id) ? rows : [...rows, row].sort(byActivity))),
      commit: async () => {
        try {
          await putAwayConversation(owner, row.id);
        } catch {
          return false;
        }
        change((rows) => rows.filter((item) => item.id !== row.id));
        if (wasOpen) openConversation(owner.id, programme, null);
        return true;
      },
    });
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
            <RowActions
              title={item.name}
              actions={[
                { key: 'rename', icon: 'sign', label: t('discovery.rows.rename'), short: t('discovery.rows.renameShort'), onPress: () => setRenaming(item) },
                item.turn_count
                  ? { key: 'remove', icon: 'archive', label: t('discovery.rows.archive'), tone: 'danger', onPress: () => putAway(item) }
                  : { key: 'remove', icon: 'trash', label: t('discovery.rows.delete'), tone: 'danger', onPress: () => putAway(item) },
              ]}
              start={['rename']}
              end={['remove', 'more']}
              testID={`conversation-${item.id}`}>
              {(bind) => (
                <Row
                  bind={bind}
                  title={item.name}
                  detail={at ? date(at) : undefined}
                  selected={item.id === open}
                  onPress={() => choose(item.id)}
                  testID={`conversation-${item.id}`}
                />
              )}
            </RowActions>
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
      {renaming && active ? (
        <FormSheet
          title={t('discovery.rows.rename')}
          fields={[{ key: 'name', label: t('discovery.rows.title'), initial: renaming.name }]}
          submit={t('discovery.rows.save')}
          testID="conversation-rename"
          onClose={() => setRenaming(null)}
          onSubmit={async ({ name }) => {
            const title = name.trim();
            try {
              await renameConversation(active, renaming.id, title);
            } catch {
              return t('row.failed');
            }
            change((rows) => rows.map((row) => (row.id === renaming.id ? { ...row, name: title } : row)));
            return null;
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function byActivity(a: Conversation, b: Conversation): number {
  return String(b.last_activity_at || '').localeCompare(String(a.last_activity_at || '')) || b.id - a.id;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  action: { paddingHorizontal: space.lg, paddingBottom: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  list: { width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
