import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readableWidth } from '../../../layout/windowClass';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { conversationById, discardSend, takeSendStart, fetchNewer, getChat, loadAround, loadOlder, openSubThread, openThread, retrySend, threadOf, toggleReaction, useChat, type Delivered } from '../chat';
import { readAnchor, writeAnchor } from '../drafts';
import { plainText } from '../html';
import { bodyPreview } from '../markdown';
import { readersOf, readState } from '../odoo';
import type { Message, Pending } from '../types';
import { CallButtons } from '../../call/ui/CallButtons';
import { Avatar } from './Avatar';
import { Composer, type ComposerHandle } from './Composer';
import { useChatFormat } from './format';
import { Icon } from '../../../ui/icons';
import { MessageActions } from './MessageActions';
import { isCallNotice } from '../odoo';
import { MessageBubble, PendingBubble, type Quote } from './MessageBubble';
import { NotifySheet } from './NotifySheet';
import { router } from 'expo-router';
import { ChatBackground } from '../../appearance/ChatBackground';

type Row =
  | { kind: 'day'; key: string; date: number }
  | { kind: 'message'; key: string; message: Message; showAuthor: boolean }
  | { kind: 'pending'; key: string; pending: Pending };

const groupGapMs = 5 * 60 * 1000;

export function buildRows(messages: Message[], pending: Pending[], delivered: Delivered[], sameDay: (a: number, b: number) => boolean): Row[] {
  const rows: Row[] = [];
  let previous: Message | null = null;
  for (const message of messages) {
    if (previous && isCallNotice(previous) && isCallNotice(message) && sameDay(previous.date, message.date)) continue;
    if (!previous || !sameDay(previous.date, message.date)) rows.push({ kind: 'day', key: `day-${message.id}`, date: message.date });
    const continues = previous && previous.authorId === message.authorId && message.date - previous.date < groupGapMs && sameDay(previous.date, message.date) && previous.type !== 'notification';
    rows.push({ kind: 'message', key: `m-${message.id}`, message, showAuthor: !continues });
    previous = message;
  }
  for (const item of delivered) rows.push({ kind: 'pending', key: `p-${item.key}`, pending: { ...item.pending, state: 'sending' } });
  for (const item of pending) rows.push({ kind: 'pending', key: `p-${item.key}`, pending: item });
  return rows;
}

export function ThreadView({
  channelId,
  twoPane,
  focusMessage,
  onOpenChannel,
  onBack,
  bubble = false,
}: {
  channelId: number;
  twoPane: boolean;
  focusMessage?: number | null;
  onOpenChannel: (id: number) => void;
  onBack?: () => void;
  bubble?: boolean;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const [notifying, setNotifying] = useState(false);
  const { dayLabel, sameDay } = useChatFormat();
  const accountId = useChat((state) => state.accountId);
  const partnerId = useChat((state) => state.partnerId);
  const origin = useChat((state) => state.origin);
  const thread = useChat((state) => threadOf(state, channelId));
  const conversation = useChat((state) => conversationById(state, channelId));
  const allPending = useChat((state) => state.pending);
  const allDelivered = useChat((state) => state.delivered);
  const online = useChat((state) => state.online);
  const list = useRef<FlashListRef<Row>>(null);
  const composer = useRef<ComposerHandle>(null);
  const [acting, setActing] = useState<Message | null>(null);
  const [highlight, setHighlight] = useState<number | null>(focusMessage ?? null);

  useEffect(() => openThread(channelId), [channelId]);

  const pending = useMemo(() => allPending.filter((item) => item.channelId === channelId), [allPending, channelId]);
  const delivered = useMemo(() => allDelivered.filter((item) => item.pending.channelId === channelId), [allDelivered, channelId]);
  const rows = useMemo(() => buildRows(thread.messages, pending, delivered, sameDay), [thread.messages, pending, delivered, sameDay]);
  const byId = useMemo(() => new Map(thread.messages.map((message) => [message.id, message])), [thread.messages]);
  const name = conversation?.name || thread.info?.name || '';
  const type = conversation?.type ?? (thread.info?.type as 'chat' | 'group' | 'channel' | undefined) ?? 'channel';
  const twoPeople = type === 'chat';

  const scrollTo = useCallback(
    (messageId: number) => {
      void loadAround(channelId, messageId).then((found) => {
        if (!found) return;
        requestAnimationFrame(() => {
          const index = buildRows(threadOf(getChat(), channelId).messages, [], [], sameDay).findIndex((row) => row.kind === 'message' && row.message.id === messageId);
          if (index >= 0) void list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.4 });
        });
      });
    },
    [channelId, sameDay],
  );

  useEffect(() => {
    if (focusMessage && thread.loaded) scrollTo(focusMessage);
  }, [focusMessage, thread.loaded, scrollTo]);

  useEffect(() => {
    if (!highlight) return;
    const timer = setTimeout(() => setHighlight(null), 2400);
    return () => clearTimeout(timer);
  }, [highlight]);

  const [initialIndex] = useState(() => {
    const anchor = accountId ? readAnchor(accountId, channelId) : null;
    if (!anchor) return undefined;
    const index = rows.findIndex((row) => row.kind === 'message' && row.message.id === anchor);
    return index >= 0 ? index : undefined;
  });

  const jumpTo = useCallback(
    (messageId: number) => {
      setHighlight(messageId);
      scrollTo(messageId);
    },
    [scrollTo],
  );

  const quoteOf = useCallback(
    (message: Message): Quote => {
      if (!message.parentId) return null;
      const parent = byId.get(message.parentId);
      if (!parent) return { author: '', authorId: null, text: t('thread.olderMessage') };
      return { author: parent.authorId === partnerId ? t('thread.you') : parent.author, authorId: parent.authorId, text: bodyPreview(parent.body) || t('list.files', { count: parent.attachments.length }) };
    },
    [byId, partnerId, t],
  );

  const openSub = useCallback(
    async (message: Message) => {
      const sub = await openSubThread(channelId, message.id);
      if (sub) onOpenChannel(sub);
    },
    [channelId, onOpenChannel],
  );

  const onSent = useCallback(() => {
    requestAnimationFrame(() => void list.current?.scrollToEnd({ animated: true }));
  }, []);

  useEffect(() => {
    for (const item of pending) {
      const started = takeSendStart(item.key);
      if (started === undefined) continue;
      requestAnimationFrame(() => console.log(`[kaitech-perf] send_visible_ms=${(performance.now() - started).toFixed(1)}`));
    }
  }, [pending]);

  const renderItem = useCallback(
    ({ item }: { item: Row }) => {
      if (item.kind === 'day') {
        return (
          <View style={styles.day} accessibilityRole="header">
            <Text variant="label" tone="inkSoft" style={[styles.dayPill, { backgroundColor: colors.surface2 }]}>
              {dayLabel(item.date)}
            </Text>
          </View>
        );
      }
      if (item.kind === 'pending') {
        return <PendingBubble pending={item.pending} offline={!online} onRetry={(key) => void retrySend(key)} onDiscard={(key) => void discardSend(key)} />;
      }
      const message = item.message;
      const mine = message.authorId === partnerId;
      const ticks = mine && type !== 'channel' ? readState(message, thread.members, partnerId) : null;
      return (
        <View style={highlight === message.id ? [styles.highlight, { backgroundColor: colors.select }] : undefined}>
          <MessageBubble
            message={message}
            mine={mine}
            showAuthor={item.showAuthor && !twoPeople}
            face={twoPeople ? 'none' : item.showAuthor ? 'show' : 'space'}
            readState={ticks}
            quote={quoteOf(message)}
            origin={origin}
            hasThread={!!thread.subChannels[message.id]}
            onLongPress={setActing}
            onQuotePress={jumpTo}
            onReact={(target, content) => void toggleReaction(target, content)}
            onOpenThread={(target) => void openSub(target)}
          />
        </View>
      );
    },
    [colors, dayLabel, highlight, jumpTo, online, openSub, origin, partnerId, quoteOf, thread.members, thread.subChannels, twoPeople, type],
  );

  const typing = thread.typing;
  const subtitle = typing.length
    ? t('thread.typing', { name: typing.map((typist) => typist.name.split(' ')[0]).join(', '), count: typing.length })
    : type === 'chat'
      ? t('thread.kind.chat')
      : thread.info?.memberCount
        ? t(`thread.members.${type === 'group' ? 'group' : 'channel'}`, { count: thread.info.memberCount })
        : t(`thread.kind.${type === 'group' ? 'group' : 'channel'}`);

  const header = (
    <View style={[styles.header, { borderBottomColor: colors.line }]}>
      {twoPane || !onBack ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel={t('thread.back')} onPress={onBack} hitSlop={8} style={styles.headerButton} testID="thread-back">
          <Icon name="back" color={colors.ink} />
        </Pressable>
      )}
      <Avatar
        name={name}
        seed={conversation?.partnerId ?? channelId}
        size={40}
        partnerId={type === 'chat' ? conversation?.partnerId : undefined}
        photo={type === 'chat' ? undefined : (conversation?.photo ?? null)}
        icon={type === 'channel' ? 'hash' : type === 'group' ? 'people' : undefined}
      />
      <View style={styles.flex}>
        <Text variant="headline" numberOfLines={1} accessibilityRole="header" testID="thread-title">
          {name}
        </Text>
        <Text variant="footnote" tone={typing.length ? 'link' : 'inkSoft'} numberOfLines={1} accessibilityLiveRegion="polite">
          {subtitle}
        </Text>
      </View>
      {!bubble && (type === 'chat' || type === 'group' || type === 'channel') ? <CallButtons channelId={channelId} channelName={name} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('notify.title')}
        onPress={() => setNotifying(true)}
        hitSlop={8}
        style={styles.headerButton}
        testID="thread-notify">
        <Icon name={conversation?.mutedUntil ? 'bellOff' : 'bell'} color={colors.ink} />
      </Pressable>
      {bubble ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('thread.background')}
          onPress={() => router.push({ pathname: '/settings/background', params: { channel: String(channelId) } })}
          hitSlop={8}
          style={styles.headerButton}
          testID="thread-background">
          <Icon name="image" color={colors.ink} />
        </Pressable>
      )}
    </View>
  );

  const empty = (
    <View style={styles.empty}>
      {thread.loading && !thread.messages.length ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text variant="callout" tone="inkSoft" style={styles.center}>
          {thread.error ? t(`errors.${thread.error === 'network' ? 'network' : 'load'}`) : t('thread.empty')}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={twoPane ? ['top', 'right'] : ['top', 'left', 'right']} style={[styles.flex, { backgroundColor: colors.canvas }]} testID={`thread-${channelId}`}>
      {header}
      <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.flex}>
        <View style={styles.flex}>
          <ChatBackground channelId={channelId} />
          <FlashList
            ref={list}
            data={rows}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.kind}
            renderItem={renderItem}
            initialScrollIndex={initialIndex}
            maintainVisibleContentPosition={{ startRenderingFromBottom: true, autoscrollToBottomThreshold: 0.2, animateAutoScrollToBottom: true }}
            onStartReached={() => void loadOlder(channelId)}
            onStartReachedThreshold={0.6}
            onEndReached={thread.hasNewer ? () => void fetchNewer(channelId) : undefined}
            onViewableItemsChanged={({ viewableItems }) => {
              if (!accountId) return;
              const first = viewableItems.find((entry) => entry.item?.kind === 'message');
              const last = viewableItems[viewableItems.length - 1];
              const atBottom = !last || last.index === null || last.index >= rows.length - 2;
              writeAnchor(accountId, channelId, atBottom || !first || first.item?.kind !== 'message' ? null : first.item.message.id);
            }}
            ListHeaderComponent={thread.loadingOlder ? <ActivityIndicator style={styles.older} color={colors.primary} /> : null}
            ListEmptyComponent={empty}
            contentContainerStyle={styles.content}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            testID="thread-list"
          />
        </View>
        {accountId ? (
          <View style={styles.composerWrap}>
            <Composer key={channelId} ref={composer} accountId={accountId} channelId={channelId} messages={thread.messages} onSent={onSent} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
      <MessageActions
        message={acting}
        mine={acting?.authorId === partnerId}
        readers={acting ? readersOf(acting, thread.members, partnerId) : 0}
        canThread={type !== 'chat' && !thread.info?.parentId}
        onClose={() => setActing(null)}
        onReply={(message) => composer.current?.reply(message)}
        onReact={(message, content) => void toggleReaction(message, content)}
        onCopy={(message) => void Clipboard.setStringAsync(plainText(message.body))}
        onThread={(message) => void openSub(message)}
      />
      {notifying ? <NotifySheet channelId={channelId} mutedUntil={conversation?.mutedUntil ?? null} onClose={() => setNotifying(false)} /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 60 },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingVertical: space.md },
  day: { alignItems: 'center', paddingVertical: space.sm },
  dayPill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, overflow: 'hidden' },
  highlight: { borderRadius: radius.md },
  older: { padding: space.md },
  empty: { padding: space.xxl, alignItems: 'center', justifyContent: 'center' },
  composerWrap: { width: '100%', maxWidth: readableWidth + 2 * space.lg, alignSelf: 'center' },
});
