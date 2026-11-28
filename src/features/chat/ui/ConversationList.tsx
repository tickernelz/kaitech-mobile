import { FlashList } from '@shopify/flash-list';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { useTabBarSpace } from '../../../layout/tabBar';
import { HeaderActions } from '../../../screens/HeaderActions';
import { useLargeText, useWindowClass } from '../../../layout/windowClass';
import { Banner } from '../../../ui/Banner';
import { Fab } from '../../../ui/Fab';
import { radius, space, useTheme } from '../../../theme';
import { TopAppBar, useScrolledUnder } from '../../../ui/AppBar';
import { Refresh } from '../../../ui/Refresh';
import { Text } from '../../../ui/Text';
import { loadArchived, loadMoreConversations, refreshConversations, useChat } from '../chat';
import { IconButton } from '../../../ui/IconButton';
import { hasFeature } from '../features';
import { listFilters, matches, type Filter } from '../listFilters';
import { pushSupported } from '../push';
import type { Conversation } from '../types';
import { Avatar } from './Avatar';
import { useChatFormat } from './format';
import { VoiceMiniBar } from './VoiceNote';
import { previewText } from '../rich';
import { Icon } from '../../../ui/icons';
import { RowActions } from '../../../ui/RowActions';
import { conversationActions } from './conversationActions';
import { refreshStarred } from '../starred';
import { StarredSheet } from './thread/ListSheets';
import { TicketsSheet } from './coworker/Tickets';
import { chipBand, chipHeight, chipSlop, touchTarget } from '../../../ui/touch';

function usePreview() {
  const { t } = useTranslation('chat');
  const partnerId = useChat((state) => state.partnerId);
  return useCallback(
    (conversation: Conversation): { author: string; text: string } => {
      const last = conversation.last;
      if (!last) return { author: '', text: t('list.noMessages') };
      if (last.call) return { author: '', text: t('thread.call') };
      const mine = last.authorId === partnerId;
      const author = mine ? t('list.you') : conversation.type === 'chat' ? '' : last.author.split(' ')[0];
      const text = last.rich ? previewText(last.rich, (key) => t(key)) : last.text || (last.voice ? t('list.voice') : last.attachments ? t('list.files', { count: last.attachments }) : '');
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
  inArchive,
}: {
  conversation: Conversation;
  selected: boolean;
  pending: number;
  onOpen: (id: number) => void;
  inArchive: boolean;
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
    <RowActions
      title={conversation.name}
      actions={conversationActions(t, conversation, inArchive)}
      start={['read', 'pin']}
      end={['archive', 'more']}
      testID={`conversation-${conversation.id}`}>
      {(bind) => (
    <Pressable
      {...bind}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => onOpen(conversation.id)}
      testID={`conversation-${conversation.id}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: selected ? colors.select : pressed ? colors.surface2 : colors.canvas },
      ]}>
      <Avatar
        name={conversation.name}
        seed={conversation.partnerId ?? conversation.id}
        icon={icon}
        partnerId={conversation.type === 'chat' ? conversation.partnerId : undefined}
        photo={conversation.type === 'chat' ? undefined : (conversation.photo ?? null)}
      />
      <View style={[styles.rowBody, { borderBottomColor: colors.line }]}>
        <View style={styles.rowTop}>
          <Text variant="headline" numberOfLines={1} style={styles.flex}>
            {conversation.name}
          </Text>
          {conversation.pinned ? <Icon name="pin" size={16} color={colors.inkFaint} /> : null}
          <Text variant="footnote" tone={unread ? 'link' : 'inkFaint'} style={unread && styles.strong}>
            {listTime(conversation.last?.date ?? conversation.activityAt)}
          </Text>
        </View>
        <View style={styles.rowTop}>
          {conversation.last?.call ? <Icon name="phone" size={16} color={colors.inkSoft} /> : null}
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
      )}
    </RowActions>
  );
});

export function ConversationList({
  selectedId,
  onOpen,
  onNew,
}: {
  selectedId: number | null;
  onOpen: (id: number, message?: number | null) => void;
  onNew: () => void;
}) {
  const { t } = useTranslation(['chat', 'translation']);
  const { colors } = useTheme();
  const tabSpace = useTabBarSpace();
  const { short } = useWindowClass();
  const largeText = useLargeText();
  const conversations = useChat((state) => state.conversations);
  const loading = useChat((state) => state.listLoading);
  const loaded = useChat((state) => state.listLoaded);
  const error = useChat((state) => state.listError);
  const online = useChat((state) => state.online);
  const pending = useChat((state) => state.pending);
  const archivedSummary = useChat((state) => state.archivedSummary);
  const archived = useChat((state) => state.archived);
  const [chosen, setFilter] = useState<Filter>('all');
  const features = useChat((state) => state.features);
  const filters = useMemo(() => listFilters(hasFeature(features, 'chat_filters'), hasFeature(features, 'agents')), [features]);
  const filter = filters.includes(chosen) ? chosen : 'all';
  const [inArchive, setInArchive] = useState(false);
  const [inStarred, setInStarred] = useState(false);
  const [inTickets, setInTickets] = useState(false);
  const starred = useChat((state) => state.starred);
  const accountId = useChat((state) => state.accountId);
  useEffect(() => {
    if (accountId) void refreshStarred();
  }, [accountId]);
  const waiting = useMemo(() => {
    const counts = new Map<number, number>();
    for (const item of pending) counts.set(item.channelId, (counts.get(item.channelId) ?? 0) + 1);
    return counts;
  }, [pending]);
  const shown = useMemo(
    () => (inArchive ? (archived ?? []) : conversations.filter((conversation) => matches(conversation, filter))),
    [archived, conversations, filter, inArchive],
  );
  const openArchive = () => {
    setInArchive(true);
    void loadArchived();
  };
  const unreadTotal = useMemo(() => conversations.filter((conversation) => conversation.unread > 0).length, [conversations]);
  const bar = useScrolledUnder();

  const archiveBack = <IconButton icon="back" label={t('translation:row.back')} onPress={() => setInArchive(false)} testID="chat-archive-back" />;

  const starredEntry =
    filter === 'all' && starred > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('starredList.title')}, ${starred}`}
        onPress={() => setInStarred(true)}
        testID="chat-starred-open"
        style={({ pressed }) => [styles.archiveEntry, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}>
        <Icon name="star" size={20} color={colors.inkSoft} />
        <Text variant="callout" style={styles.flex}>
          {t('starredList.title')}
        </Text>
        <Text variant="footnote" tone="inkFaint">
          {starred}
        </Text>
      </Pressable>
    ) : null;

  const ticketsEntry =
    filter === 'all' && hasFeature(features, 'agents') ? (
      <Pressable
        accessibilityRole="button"
        onPress={() => setInTickets(true)}
        testID="chat-tickets-open"
        style={({ pressed }) => [styles.archiveEntry, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}>
        <Icon name="sparkle" size={20} color={colors.inkSoft} />
        <Text variant="callout" style={styles.flex}>
          {t('tickets.title')}
        </Text>
        <Icon name="chevronDown" size={20} color={colors.inkFaint} />
      </Pressable>
    ) : null;

  const archiveEntry =
    filter === 'all' && archivedSummary && archivedSummary.count > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[t('rowActions.archivedTitle'), String(archivedSummary.count), archivedSummary.unread ? t('list.unreadCount', { count: archivedSummary.unread }) : ''].filter(Boolean).join(', ')}
        onPress={openArchive}
        testID="chat-archive-open"
        style={({ pressed }) => [styles.archiveEntry, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}>
        <Icon name="archive" size={20} color={colors.inkSoft} />
        <Text variant="callout" style={styles.flex}>
          {t('rowActions.archivedTitle')}
        </Text>
        <Text variant="footnote" tone={archivedSummary.unread ? 'link' : 'inkFaint'} style={archivedSummary.unread ? styles.strong : undefined}>
          {archivedSummary.unread || archivedSummary.count}
        </Text>
      </Pressable>
    ) : null;

  const chips = filters.map((name) => {
    const on = filter === name;
    return (
      <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityState={{ selected: on }}
        accessibilityLabel={name === 'unread' && unreadTotal ? `${t('list.filter.unread')}, ${unreadTotal}` : undefined}
        onPress={() => setFilter(name)}
        hitSlop={chipSlop}
        testID={`chat-filter-${name}`}
        style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line }]}>
        <Text variant="callout" style={{ color: on ? colors.onPrimary : colors.ink }}>
          {t(`list.filter.${name}`)}
        </Text>
        {name === 'unread' && unreadTotal ? (
          <View style={[styles.count, { backgroundColor: on ? colors.onPrimary : colors.primary }]}>
            <Text variant="label" style={{ color: on ? colors.primary : colors.onPrimary }}>
              {unreadTotal}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  });

  const header = (
    <View style={styles.header}>
      {largeText ? (
        <View style={[styles.chips, styles.wrap, styles.chipBar]} accessibilityRole="tablist">
          {chips}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipBar} contentContainerStyle={styles.chips} accessibilityRole="tablist">
          {chips}
        </ScrollView>
      )}
      {!online ? (
        <Banner tone="warn" icon="cloudOff" text={pending.length ? t('list.offlineQueued', { count: pending.length }) : t('list.offline')} testID="chat-offline" />
      ) : null}
      {!pushSupported ? <Banner tone="info" icon="bell" text={t('list.iosNoPush')} testID="chat-ios-push-note" /> : null}
      {archiveEntry}
      {ticketsEntry}
      {starredEntry}
    </View>
  );

  const empty = (
    <View style={styles.empty}>
      <Text variant="headline" style={styles.center}>
        {inArchive
          ? archived === null
            ? t('list.loading')
            : t('rowActions.archivedEmpty')
          : error && !conversations.length
            ? t(`errors.${error === 'network' ? 'network' : 'load'}`)
            : loaded || !loading
              ? t(`list.empty.${filter}`)
              : t('list.loading')}
      </Text>
    </View>
  );

  return (
    <View style={styles.flex} testID="chat-list">
      <TopAppBar
        title={inArchive ? t('rowActions.archivedTitle') : t('translation:tabs.chat')}
        scrolled={bar.scrolled}
        navigation={inArchive ? archiveBack : null}
        actions={
          inArchive ? null : (
            <>
              {short ? <IconButton icon="edit" label={t('newChat.title')} onPress={onNew} testID="chat-new" /> : null}
              <HeaderActions />
            </>
          )
        }
      />
      <VoiceMiniBar />
      <FlashList
        onScroll={bar.onScroll}
        scrollEventThrottle={16}
        data={shown}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <Row conversation={item} selected={item.id === selectedId} pending={waiting.get(item.id) ?? 0} onOpen={onOpen} inArchive={inArchive} />}
        extraData={`${selectedId}|${pending.length}|${inArchive}`}
        contentContainerStyle={{ paddingBottom: tabSpace + (inArchive || short ? space.sm : fabClearance) }}
        ListHeaderComponent={inArchive ? null : header}
        ListEmptyComponent={empty}
        onEndReached={() => void (inArchive ? loadArchived(true) : loadMoreConversations())}
        onEndReachedThreshold={0.5}
        refreshControl={
          <Refresh
            onRefresh={() => {
              if (!inArchive) void refreshStarred();
              return inArchive ? loadArchived() : refreshConversations();
            }}
          />
        }
      />
      {inArchive || short ? null : <Fab icon="edit" label={t('newChat.title')} onPress={onNew} testID="chat-new" />}
      {inTickets ? <TicketsSheet onClose={() => setInTickets(false)} onOpenThread={(channelId, messageId) => onOpen(channelId, messageId)} /> : null}
      {inStarred ? (
        <StarredSheet
          onClose={() => setInStarred(false)}
          onOpen={(message) => {
            setInStarred(false);
            onOpen(message.channelId, message.id);
          }}
        />
      ) : null}
    </View>
  );
}

const fabClearance = 56 + space.lg * 2;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  archiveEntry: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth },
  strong: { fontWeight: '600' },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, gap: space.md },
  chipBar: { marginVertical: chipBand.marginVertical },
  chips: { gap: space.sm, paddingHorizontal: space.xs, paddingVertical: chipBand.paddingVertical },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: { minHeight: chipHeight, minWidth: touchTarget, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: space.xs },
  count: { minWidth: 18, minHeight: 18, borderRadius: radius.pill, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, minHeight: 76 },
  rowBody: { flex: 1, paddingVertical: space.md, paddingRight: space.lg, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: space.xxl, alignItems: 'center' },
});
