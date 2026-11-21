import { FlashList } from '@shopify/flash-list';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { HeaderActions } from '../../../screens/HeaderActions';
import { radius, selectionBar, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { loadMoreConversations, refreshConversations, useChat } from '../chat';
import { pushSupported } from '../push';
import type { Conversation } from '../types';
import { Avatar } from './Avatar';
import { useChatFormat } from './format';
import { Icon } from '../../../ui/icons';

type Filter = 'all' | 'unread' | 'people' | 'rooms';
const filters: Filter[] = ['all', 'unread', 'people', 'rooms'];

function matches(conversation: Conversation, filter: Filter): boolean {
  if (filter === 'unread') return conversation.unread > 0;
  if (filter === 'people') return conversation.type === 'chat';
  if (filter === 'rooms') return conversation.type !== 'chat';
  return true;
}

function usePreview() {
  const { t } = useTranslation('chat');
  const partnerId = useChat((state) => state.partnerId);
  return useCallback(
    (conversation: Conversation): { author: string; text: string } => {
      const last = conversation.last;
      if (!last) return { author: '', text: t('list.noMessages') };
      const mine = last.authorId === partnerId;
      const author = mine ? t('list.you') : conversation.type === 'chat' ? '' : last.author.split(' ')[0];
      const text = last.text || (last.voice ? t('list.voice') : last.attachments ? t('list.files', { count: last.attachments }) : '');
      return { author, text };
    },
    [partnerId, t],
  );
}

const Row = memo(function Row({
  conversation,
  selected,
  pending,
  onOpen,
}: {
  conversation: Conversation;
  selected: boolean;
  pending: number;
  onOpen: (id: number) => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { listTime } = useChatFormat();
  const preview = usePreview()(conversation);
  const unread = conversation.unread > 0;
  const muted = !!conversation.mutedUntil;
  const icon = conversation.type === 'channel' ? 'hash' : conversation.type === 'group' ? 'people' : undefined;
  const label = [
    conversation.name,
    unread ? t('list.unreadCount', { count: conversation.unread }) : '',
    preview.author ? `${preview.author}: ${preview.text}` : preview.text,
    listTime(conversation.last?.date ?? conversation.activityAt),
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onOpen(conversation.id)}
      testID={`conversation-${conversation.id}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: selected ? colors.select : pressed ? colors.surface2 : 'transparent' },
        selected && { borderLeftWidth: selectionBar, borderLeftColor: colors.primary, paddingLeft: space.lg - selectionBar },
      ]}>
      <Avatar name={conversation.name} path={conversation.type === 'chat' ? conversation.avatar : undefined} seed={conversation.partnerId ?? conversation.id} icon={icon} />
      <View style={[styles.rowBody, { borderBottomColor: colors.line }]}>
        <View style={styles.rowTop}>
          <Text variant="headline" numberOfLines={1} style={styles.flex}>
            {conversation.name}
          </Text>
          <Text variant="footnote" tone={unread ? 'link' : 'inkFaint'} style={unread && styles.strong}>
            {listTime(conversation.last?.date ?? conversation.activityAt)}
          </Text>
        </View>
        <View style={styles.rowTop}>
          <Text variant="callout" tone="inkSoft" numberOfLines={2} style={styles.flex}>
            {pending ? (
              <Text variant="callout" tone="warnInk">
                {t('list.waiting', { count: pending })}{' '}
              </Text>
            ) : null}
            {preview.author ? (
              <Text variant="callout" tone="ink" style={styles.strong}>
                {preview.author}:{' '}
              </Text>
            ) : null}
            {preview.text}
          </Text>
          {muted ? <Icon name="bellOff" size={16} color={colors.inkFaint} /> : null}
          {unread ? (
            <View style={[styles.badge, { backgroundColor: muted ? colors.inkFaint : colors.primary }]}>
              <Text variant="label" maxFontSizeMultiplier={1.4} style={{ color: colors.onPrimary }}>
                {conversation.unread > 99 ? '99+' : conversation.unread}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

export function ConversationList({ selectedId, onOpen }: { selectedId: number | null; onOpen: (id: number) => void }) {
  const { t } = useTranslation(['chat', 'translation']);
  const { colors } = useTheme();
  const conversations = useChat((state) => state.conversations);
  const loading = useChat((state) => state.listLoading);
  const loaded = useChat((state) => state.listLoaded);
  const error = useChat((state) => state.listError);
  const online = useChat((state) => state.online);
  const pending = useChat((state) => state.pending);
  const [filter, setFilter] = useState<Filter>('all');
  const [pulled, setPulled] = useState(false);
  const waiting = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of pending) counts.set(item.channelId, (counts.get(item.channelId) ?? 0) + 1);
    return counts;
  }, [pending]);
  const shown = useMemo(() => conversations.filter((conversation) => matches(conversation, filter)), [conversations, filter]);
  const unreadTotal = useMemo(() => conversations.filter((conversation) => conversation.unread > 0).length, [conversations]);

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text variant="display" accessibilityRole="header" style={styles.flex}>
          {t('translation:tabs.chat')}
        </Text>
        <HeaderActions />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
        {filters.map((name) => {
          const on = filter === name;
          return (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setFilter(name)}
              testID={`chat-filter-${name}`}
              style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line }]}>
              <Text variant="callout" style={{ color: on ? colors.onPrimary : colors.ink }}>
                {t(`list.filter.${name}`)}
                {name === 'unread' && unreadTotal ? ` ${unreadTotal}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {!online ? (
        <View style={[styles.banner, { backgroundColor: colors.warnBand }]} accessibilityLiveRegion="polite" testID="chat-offline">
          <Icon name="cloudOff" size={20} color={colors.warnInk} />
          <Text variant="footnote" tone="warnInk" style={styles.flex}>
            {pending.length ? t('list.offlineQueued', { count: pending.length }) : t('list.offline')}
          </Text>
        </View>
      ) : null}
      {!pushSupported ? (
        <View style={[styles.banner, { backgroundColor: colors.infoBand }]} testID="chat-ios-push-note">
          <Icon name="bell" size={20} color={colors.infoInk} />
          <Text variant="footnote" tone="infoInk" style={styles.flex}>
            {t('list.iosNoPush')}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const empty = (
    <View style={styles.empty}>
      <Text variant="headline" style={styles.center}>
        {error && !conversations.length ? t(`errors.${error === 'network' ? 'network' : 'load'}`) : loaded || !loading ? t(`list.empty.${filter}`) : t('list.loading')}
      </Text>
    </View>
  );

  return (
    <View style={styles.flex} testID="chat-list">
      <FlashList
        data={shown}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <Row conversation={item} selected={item.id === selectedId} pending={waiting.get(item.id) ?? 0} onOpen={onOpen} />}
        extraData={`${selectedId}|${pending.length}`}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        onEndReached={() => void loadMoreConversations()}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={pulled && loading}
            onRefresh={() => {
              setPulled(true);
              void refreshConversations().finally(() => setPulled(false));
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  strong: { fontWeight: '600' },
  header: { paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.sm, gap: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.xs },
  chips: { gap: space.sm, paddingHorizontal: space.xs },
  chip: { minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, minHeight: 76 },
  rowBody: { flex: 1, paddingVertical: space.md, paddingRight: space.lg, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: space.xxl, alignItems: 'center' },
});
