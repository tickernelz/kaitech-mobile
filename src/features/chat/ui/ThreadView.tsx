import { FlashList, type FlashListRef } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { readableWidth } from '../../../layout/windowClass';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { chatClient, loadWorks, refreshConversations, conversationById, discardSend, takeSendStart, fetchNewer, getChat, loadAround, loadOlder, openSubThread, openThread, retrySend, threadOf, toggleReaction, useChat, type Delivered } from '../chat';
import { readAnchor, writeAnchor } from '../drafts';
import { plainText } from '../html';
import { bodyPreview, bodyShape } from '../markdown';
import { isCallNotice, readersOf, readState } from '../odoo';
import type { Message, Pending } from '../types';
import { CallButton } from '../../call/ui/CallButton';
import { Avatar } from './Avatar';
import { Composer, type ComposerHandle } from './Composer';
import { useChatFormat } from './format';
import { Icon } from '../../../ui/icons';
import { MessageActions, type MessageAction } from './MessageActions';
import { messageOptions } from '../messageOptions';
import { hasFeature } from '../features';
import { markUnreadFrom, messageLink, removeMessage, setPinned, toggleStar, toggleTranslation, type Result } from '../messageActions';
import { failureText } from './actions/failure';
import { EmojiPicker } from './EmojiPicker';
import { ActivitySheet } from './actions/ActivitySheet';
import { ForwardSheet } from './actions/ForwardSheet';
import { MeetingSheet } from './actions/MeetingSheet';
import { ReactionsSheet } from './actions/ReactionsSheet';
import { ReadersSheet } from './actions/ReadersSheet';
import { TaskSheet } from './actions/TaskSheet';
import { ThreadActionsSheet } from './thread/ThreadActionsSheet';
import { useAutoTranslate } from './useAutoTranslate';
import { MessageCards, useAgentCards, useRecordCards } from './coworker/Cards';
import { WorkBar, WorkSheet } from './coworker/Work';
import { linksOfMessage, type RecordCard } from '../coworker';
import { MessageBubble, PendingBubble, type Quote } from './MessageBubble';
import { NotifySheet } from './NotifySheet';
import { router } from 'expo-router';
import { ChatBackground } from '../../appearance/ChatBackground';
import { usePartnerStatus } from '../../people/statuses';
import { confirm, inform } from '../../../ui/dialog';

type Row =
  | { kind: 'day'; key: string; date: number }
  | { kind: 'message'; key: string; message: Message; showAuthor: boolean }
  | { kind: 'pending'; key: string; pending: Pending };

const groupGapMs = 5 * 60 * 1000;
const noticeMs = 4000;
const noLinks: string[] = [];

type SheetKind = 'emoji' | 'forward' | 'task' | 'activity' | 'meeting' | 'reactions' | 'readers';

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

export function rowType(row: Row): string {
  return row.kind === 'message' ? `message-${bodyShape(row.message.body)}` : row.kind;
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
  const [threadMenu, setThreadMenu] = useState(false);
  const [workSheet, setWorkSheet] = useState(false);
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
  const [actingAt, setActingAt] = useState(0);
  const startActing = useCallback((message: Message) => {
    setActingAt(Date.now());
    setActing(message);
  }, []);
  const [sheet, setSheet] = useState<{ kind: SheetKind; message: Message } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const features = useChat((state) => state.features);
  const myUserId = useChat((state) => state.userId);
  const seeTranslations = useAutoTranslate(features.translateAuto && !!features.translateLanguage);
  const agentStore = useAgentCards(channelId);
  const recordStore = useRecordCards();
  const agentsOn = hasFeature(features, 'agents');
  const cardsOn = hasFeature(features, 'cards');
  const lookOn = hasFeature(features, 'look');
  const agentIds = useMemo(() => new Set([...features.agentPartnerIds, ...(features.coworkerPartnerId ? [features.coworkerPartnerId] : [])]), [features.agentPartnerIds, features.coworkerPartnerId]);
  const watchVisible = (messages: Message[]) => {
    seeTranslations(messages);
    if (agentsOn) agentStore.want(messages.filter((message) => message.authorId !== null && agentIds.has(message.authorId)).map((message) => message.id));
    if (cardsOn) recordStore.want(messages.flatMap((message) => linksOfMessage(message, origin)));
  };
  const openRecord = useCallback(
    (card: Pick<RecordCard, 'model' | 'id'>) => {
      if (card.model === 'ck.engagement') router.push({ pathname: '/program/[id]/coworker', params: { id: String(card.id) } });
      else void Linking.openURL(`${origin}/mail/view?model=${encodeURIComponent(card.model)}&res_id=${card.id}`);
    },
    [origin],
  );
  const linkedOn = hasFeature(features, 'linked_channels');
  useEffect(() => {
    if (agentsOn) void loadWorks(channelId);
  }, [agentsOn, channelId]);
  const [highlight, setHighlight] = useState<number | null>(focusMessage ?? null);

  useEffect(() => openThread(channelId), [channelId]);

  const pending = useMemo(() => allPending.filter((item) => item.channelId === channelId), [allPending, channelId]);
  const delivered = useMemo(() => allDelivered.filter((item) => item.pending.channelId === channelId), [allDelivered, channelId]);
  const rows = useMemo(() => buildRows(thread.messages, pending, delivered, sameDay), [thread.messages, pending, delivered, sameDay]);
  const subThreads = useMemo(
    () => Object.entries(thread.subChannels).map(([messageId, id]) => ({ id, name: bodyPreview(thread.messages.find((message) => message.id === Number(messageId))?.body ?? '') || `#${id}` })),
    [thread.messages, thread.subChannels],
  );
  const byId = useMemo(() => new Map(thread.messages.map((message) => [message.id, message])), [thread.messages]);
  const name = conversation?.name || thread.info?.name || '';
  const type = conversation?.type ?? (thread.info?.type as 'chat' | 'group' | 'channel' | undefined) ?? 'channel';
  const twoPeople = type === 'chat';
  const status = usePartnerStatus(accountId, twoPeople ? conversation?.partnerId : null);

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

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), noticeMs);
    return () => clearTimeout(timer);
  }, [notice]);

  const react = useCallback(
    async (message: Message, content: string) => {
      const failure = await toggleReaction(message, content);
      if (failure) setNotice(failureText(t, { code: failure, detail: null }));
    },
    [t],
  );

  const report = useCallback((result: Result<unknown>, done?: string) => {
    if (!result.ok) setNotice(failureText(t, result));
    else if (done) setNotice(done);
  }, [t]);

  const onAction = (action: MessageAction, message: Message) => {
    setActing(null);
    switch (action) {
      case 'reply':
        composer.current?.reply(message);
        return;
      case 'edit':
        composer.current?.edit(message);
        return;
      case 'copy':
        void Clipboard.setStringAsync(plainText(message.body)).then(() => setNotice(t('act.copied')));
        return;
      case 'link':
        void Clipboard.setStringAsync(messageLink(origin, message)).then(() => setNotice(t('act.linkCopied')));
        return;
      case 'thread':
        void openSub(message);
        return;
      case 'pin':
        void setPinned(message, !message.pinnedAt).then((result) => report(result, message.pinnedAt ? t('act.unpinned') : t('act.pinned')));
        return;
      case 'star':
        void toggleStar(message).then((result) => report(result, message.starred ? t('act.unstarred') : t('act.starred')));
        return;
      case 'translate':
        void toggleTranslation(message).then((result) => {
          if (!result.ok) report(result);
          else if (!result.value && !message.translated) setNotice(t('act.noTranslation'));
        });
        return;
      case 'unread':
        void markUnreadFrom(message).then((result) => {
          report(result);
          if (result.ok && onBack && !twoPane) onBack();
          else if (result.ok) setNotice(t('act.markedUnread'));
        });
        return;
      case 'delete':
        void confirm({ title: t('act.deleteTitle'), body: t('act.deleteBody'), cancel: t('act.cancel'), confirm: t('actions.delete'), danger: true, icon: 'trash', testID: 'message-delete-dialog' }).then(async (go) => {
          if (go) report(await removeMessage(message));
        });
        return;
      default:
        setSheet({ kind: action, message });
    }
  };

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
      const fromAgent = agentsOn && message.authorId !== null && agentIds.has(message.authorId);
      const urls = cardsOn ? linksOfMessage(message, origin) : noLinks;
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
            onLongPress={startActing}
            onQuotePress={jumpTo}
            onReact={(target, content) => void react(target, content)}
            onOpenThread={(target) => void openSub(target)}
            agent={fromAgent ? agentStore : null}
            agentTag={lookOn}
          />
          {fromAgent || urls.length ? (
            <MessageCards
              messageId={message.id}
              urls={urls}
              mine={mine}
              indent={!mine && !twoPeople}
              agents={fromAgent ? agentStore : null}
              records={urls.length ? recordStore : null}
              onOpen={openRecord}
            />
          ) : null}
        </View>
      );
    },
    [agentIds, agentStore, agentsOn, cardsOn, lookOn, colors, dayLabel, highlight, jumpTo, online, openRecord, openSub, origin, partnerId, quoteOf, react, recordStore, startActing, thread.members, thread.subChannels, twoPeople, type],
  );

  const typing = thread.typing;
  const subtitle = typing.length
    ? t('thread.typing', { name: typing.map((typist) => typist.name.split(' ')[0]).join(', '), count: typing.length })
    : type === 'chat'
      ? (status ?? t('thread.kind.chat'))
      : thread.info?.memberCount
        ? t(`thread.members.${type === 'group' ? 'group' : 'channel'}`, { count: thread.info.memberCount })
        : t(`thread.kind.${type === 'group' ? 'group' : 'channel'}`);
  const shownStatus = !typing.length && twoPeople && status ? status : null;
  const readStatus = shownStatus ? () => void inform({ title: name, body: shownStatus, testID: 'thread-status-dialog' }) : undefined;

  const parentId = thread.info?.parentId ?? null;
  const back = twoPane ? (parentId ? () => onOpenChannel(parentId) : undefined) : onBack;
  const header = (
    <View style={[styles.header, { borderBottomColor: colors.line }]}>
      {!back ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel={t('thread.back')} onPress={back} hitSlop={8} style={styles.headerButton} testID="thread-back">
          <Icon name="back" color={colors.ink} />
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('thread.openPerson', { name })}
        disabled={type !== 'chat' || !conversation?.partnerId}
        onPress={() => conversation?.partnerId && router.push({ pathname: '/person/[id]', params: { id: String(conversation.partnerId), name } })}
        testID="thread-person">
        <Avatar
          name={name}
          seed={conversation?.partnerId ?? channelId}
          size={40}
          partnerId={type === 'chat' ? conversation?.partnerId : undefined}
          photo={type === 'chat' ? undefined : (conversation?.photo ?? null)}
          icon={type === 'channel' ? 'hash' : type === 'group' ? 'people' : undefined}
        />
      </Pressable>
      <Pressable style={styles.flex} accessible={false} disabled={!readStatus} onPress={readStatus} testID="thread-heading">
        <Text variant="headline" numberOfLines={1} accessibilityRole="header" testID="thread-title">
          {name}
        </Text>
        <Text
          variant="footnote"
          tone={typing.length ? 'link' : 'inkSoft'}
          numberOfLines={1}
          accessibilityLiveRegion="polite"
          accessibilityLabel={shownStatus ? t('thread.status', { status: shownStatus }) : undefined}
          accessibilityRole={readStatus ? 'button' : undefined}
          onPress={readStatus}
          testID="thread-subtitle">
          {subtitle}
        </Text>
      </Pressable>
      {!bubble && (type === 'chat' || type === 'group' || type === 'channel') ? <CallButton channelId={channelId} channelName={name} /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={t('threadActions.more')} onPress={() => setThreadMenu(true)} hitSlop={8} style={styles.headerButton} testID="thread-more">
        <Icon name="more" color={colors.ink} />
      </Pressable>
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
      {thread.info?.link && linkedOn ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => thread.info?.link && openRecord(thread.info.link)}
          style={[styles.linked, { backgroundColor: colors.surface2, borderBottomColor: colors.line }]}
          testID="linked-bar">
          <Icon name={thread.info.link.model === 'ck.engagement' ? 'compass' : 'doc'} size={20} color={colors.inkSoft} />
          <Text variant="footnote" tone="inkSoft" numberOfLines={1} style={styles.flex}>
            {t(thread.info.link.model === 'ck.engagement' ? 'linked.programme' : 'linked.project')} · {thread.info.link.name}
          </Text>
        </Pressable>
      ) : null}
      {agentsOn ? <WorkBar works={thread.works} onPress={() => setWorkSheet(true)} /> : null}
      <KeyboardAvoidingView behavior="padding" automaticOffset style={styles.flex}>
        <View style={styles.flex}>
          <ChatBackground channelId={channelId} />
          <FlashList
            ref={list}
            data={rows}
            keyExtractor={(item) => item.key}
            getItemType={rowType}
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
              watchVisible(viewableItems.flatMap((entry) => (entry.item?.kind === 'message' ? [entry.item.message] : [])));
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
            <Composer key={channelId} ref={composer} accountId={accountId} channelId={channelId} messages={thread.messages} onSent={onSent} onNotice={setNotice} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
      {notice ? (
        <View pointerEvents="none" style={styles.noticeWrap}>
          <Text variant="footnote" accessibilityLiveRegion="polite" style={[styles.notice, { backgroundColor: colors.ink, color: colors.canvas }]} testID="thread-notice">
            {notice}
          </Text>
        </View>
      ) : null}
      <MessageActions
        message={acting}
        mine={acting?.authorId === partnerId}
        readers={acting ? readersOf(acting, thread.members, partnerId) : 0}
        options={acting ? messageOptions(acting, { partnerId, features, channelType: type, inSubThread: !!thread.info?.parentId, now: actingAt }) : {}}
        onClose={() => setActing(null)}
        onReact={(message, content) => void react(message, content)}
        onAction={onAction}
      />
      {sheet?.kind === 'emoji' ? (
        <EmojiPicker
          selected={sheet.message.reactions.filter((reaction) => reaction.mine).map((reaction) => reaction.content)}
          onClose={() => setSheet(null)}
          onPick={(emoji) => {
            const target = sheet.message;
            setSheet(null);
            void react(target, emoji);
          }}
        />
      ) : null}
      {sheet?.kind === 'reactions' ? <ReactionsSheet message={byId.get(sheet.message.id) ?? sheet.message} onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === 'readers' ? <ReadersSheet message={sheet.message} onClose={() => setSheet(null)} /> : null}
      {sheet?.kind === 'forward' ? <ForwardSheet message={sheet.message} onClose={() => setSheet(null)} onDone={(text) => { setSheet(null); setNotice(text); }} /> : null}
      {sheet?.kind === 'task' ? <TaskSheet message={sheet.message} onClose={() => setSheet(null)} onDone={(text) => { setSheet(null); setNotice(text); }} /> : null}
      {sheet?.kind === 'activity' ? <ActivitySheet message={sheet.message} onClose={() => setSheet(null)} onDone={(text) => { setSheet(null); setNotice(text); }} /> : null}
      {sheet?.kind === 'meeting' ? <MeetingSheet channelId={channelId} messageId={sheet.message.id} onClose={() => setSheet(null)} onDone={(text) => { setSheet(null); setNotice(text); }} /> : null}
      {threadMenu ? (
        <ThreadActionsSheet
          channelId={channelId}
          type={type}
          name={name}
          info={thread.info}
          features={features}
          myUserId={myUserId}
          muted={!!conversation?.mutedUntil}
          threads={subThreads}
          onClose={() => setThreadMenu(false)}
          onNotify={() => setNotifying(true)}
          onWork={agentsOn ? () => setWorkSheet(true) : undefined}
          onBackground={bubble ? undefined : () => router.push({ pathname: '/settings/background', params: { channel: String(channelId) } })}
          onMarkRead={() => {
            const last = thread.messages[thread.messages.length - 1];
            if (last) void chatClient()?.markAsRead(channelId, last.id).then(() => refreshConversations()).catch(() => undefined);
          }}
          onJump={(message) => jumpTo(message.id)}
          onOpenChannel={onOpenChannel}
          onTakeBack={(taken) => composer.current?.restore(taken.body, taken.partnerIds)}
          onNotice={setNotice}
          onLeft={() => {
            if (twoPane && parentId) onOpenChannel(parentId);
            else onBack?.();
          }}
        />
      ) : null}
      {workSheet ? <WorkSheet works={thread.works} myUserId={myUserId} onClose={() => setWorkSheet(false)} onJump={jumpTo} onNotice={setNotice} /> : null}
      {notifying ? (
        <NotifySheet
          channelId={channelId}
          notifications={type === 'chat' ? undefined : (thread.info?.notifications ?? null)}
          mutedUntil={conversation?.mutedUntil ?? null}
          onClose={() => setNotifying(false)}
        />
      ) : null}
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
  linked: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 36, paddingHorizontal: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  noticeWrap: { position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center', paddingHorizontal: space.lg },
  notice: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill, overflow: 'hidden', maxWidth: 480, textAlign: 'center' },
  composerWrap: { width: '100%', maxWidth: readableWidth + 2 * space.lg, alignSelf: 'center' },
});
