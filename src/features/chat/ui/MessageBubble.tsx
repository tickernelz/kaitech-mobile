import { router } from 'expo-router';
import { memo, useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable as ShapePressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Pressable } from '../../../ui/Pressable';
import { readableWidth } from '../../../layout/windowClass';
import { radius, space, stateLayer, stroke, type as typography, useTheme } from '../../../theme';
import { haptic } from '../../../ui/haptic';
import { Text } from '../../../ui/Text';
import { bodyBlocks, bodyPreview, sourceBlocks } from '../markdown';
import { attachmentUrl, callNoticeKey, isCallNotice, isRemoved, type ReadState } from '../odoo';
import { useUploadProgress } from '../progress';
import type { Attachment, Message, Pending, PendingFile, Rich } from '../types';
import { useChatFormat } from './format';
import { Icon } from '../../../ui/icons';
import { UploadProgress } from './MediaControls';
import { LocationCard } from './LocationCard';
import { PollCard } from './PollCard';
import { RichMedia, richLabel } from './RichMedia';
import { LONG_PRESS_MS, RichText } from './RichText';
import { SwipeReply } from './SwipeReply';
import { MediaAttachment } from './media/Tiles';
import { tileMax } from '../media/kind';
import { VoiceNote } from './VoiceNote';
import type { VoiceMeta } from '../voicePlayer';
import { recordingIdOf } from '../../call/recordingLink';
import { RecordingCard } from '../../call/ui/RecordingCard';
import { callState, startCall } from '../../call/call';
import { conversationById, getChat } from '../chat';
import { Avatar } from './Avatar';
import { AgentSaid } from './coworker/Cards';
import type { AgentCard, CardStore } from '../coworker';
import { reachBelow, touchTarget } from '../../../ui/touch';

export type AuthorFace = 'show' | 'space' | 'none';
export const faceSize = 32;
const reactionHeight = 32;
const reactionGap = space.xs;
const reactionSlop = reachBelow(reactionHeight, reactionGap);
const faceTarget = 48;
const faceSlop = { top: faceTarget - faceSize - 2, bottom: 2, left: faceTarget - faceSize - space.xs, right: space.xs };
export const tailReach = 8;
const tailWidth = tailReach + radius.card;
const tailHeight = radius.card;

const mediaWidth = Math.min(tileMax.width, Math.round(readableWidth * 0.8) - 2 * space.md);

const labels = new WeakMap<Message, { key: string; label: string }>();

function remember(message: Message, key: string, parts: (string | null | undefined | false)[]): string {
  const label = parts.filter(Boolean).join(', ');
  labels.set(message, { key, label });
  return label;
}

export function Attachments({ attachments, origin, mine, meta }: { attachments: Attachment[]; origin: string; mine: boolean; meta?: VoiceMeta }) {
  if (!attachments.length) return null;
  return (
    <View style={styles.attachments}>
      {attachments.map((attachment) => {
        const recordingId = recordingIdOf(attachment.url);
        if (recordingId !== null) return <RecordingCard key={attachment.id} recordingId={recordingId} mine={mine} />;
        if (attachment.voice || attachment.mimetype.startsWith('audio/')) {
          return <VoiceNote key={attachment.id} id={`a${attachment.id}`} uri={attachmentUrl(origin, attachment)} mine={mine} seed={attachment.id} meta={meta} />;
        }
        return <MediaAttachment key={attachment.id} attachment={attachment} origin={origin} mine={mine} siblings={attachments} width={mediaWidth} />;
      })}
    </View>
  );
}

function Frame({
  mine,
  children,
  onLongPress,
  label,
  testID,
  failed,
  bare,
  tail = false,
  interactive = false,
}: {
  mine: boolean;
  children: ReactNode;
  onLongPress?: () => void;
  label: string;
  testID?: string;
  failed?: boolean;
  bare?: boolean;
  tail?: boolean;
  interactive?: boolean;
}) {
  const { colors } = useTheme();
  const resting = mine ? colors.select : colors.surface;
  const pressedFill = stateLayer(resting, colors.ink);
  const edge = mine && !failed ? null : failed ? colors.danger : colors.line;
  return (
    <ShapePressable
      onLongPress={onLongPress}
      delayLongPress={LONG_PRESS_MS}
      accessible={!interactive}
      accessibilityLabel={label}
      accessibilityHint={onLongPress ? undefined : undefined}
      accessibilityActions={onLongPress ? [{ name: 'longpress' }] : undefined}
      onAccessibilityAction={onLongPress ? () => onLongPress() : undefined}
      testID={testID}
      style={({ pressed }) => [
        styles.bubble,
        bare ? [styles.bare, failed && { borderColor: colors.danger }, pressed && styles.barePressed] : [edge ? { borderColor: edge } : styles.plain, { backgroundColor: pressed ? pressedFill : resting }],
      ]}>
      {({ pressed }) => (
        <>
          {bare || !tail ? null : <Tail mine={mine} fill={pressed ? pressedFill : resting} edge={edge} />}
          {children}
        </>
      )}
    </ShapePressable>
  );
}

const tailShape = `M${tailReach} 0Q${tailReach} ${tailHeight} 0 ${tailHeight}L${tailWidth} ${tailHeight}L${tailWidth} 0Z`;

function tailOutline(line: number): string {
  const half = line / 2;
  return `M${tailReach + half} 0Q${tailReach + half} ${tailHeight - half} ${half} ${tailHeight - half}L${tailWidth} ${tailHeight - half}`;
}

function Tail({ mine, fill, edge }: { mine: boolean; fill: string; edge: string | null }) {
  return (
    <Svg
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      width={tailWidth}
      height={tailHeight}
      style={[styles.tail, mine ? styles.tailMine : styles.tailTheirs]}
      testID="bubble-tail">
      <Path d={tailShape} fill={fill} />
      {edge ? <Path d={tailOutline(stroke.thin)} stroke={edge} strokeWidth={stroke.thin} fill="none" testID="bubble-tail-edge" /> : null}
    </Svg>
  );
}

export function MessageLane({
  mine,
  indent,
  face,
  after,
  startsGroup = false,
  testID,
  children,
}: {
  mine: boolean;
  indent: boolean;
  face?: ReactNode;
  after?: ReactNode;
  startsGroup?: boolean;
  testID?: string;
  children: ReactNode;
}) {
  const lane = [styles.wrap, startsGroup && styles.groupStart];
  if (!indent || mine) {
    return (
      <View style={[lane, mine ? styles.wrapMine : styles.wrapTheirs]} testID={testID}>
        {children}
        {after}
      </View>
    );
  }
  return (
    <View style={lane} testID={testID}>
      <View style={styles.withFace}>
        {face ?? <View style={styles.faceSpace} />}
        <View style={styles.faceColumn}>{children}</View>
      </View>
      {after ? <View style={styles.afterFace}>{after}</View> : null}
    </View>
  );
}

export type Quote = { author: string; authorId: number | null; text: string } | null;

function QuoteBlock({ quote, mine, onPress }: { quote: Quote; mine: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  if (!quote) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.quoteBox, { backgroundColor: mine ? colors.surface : colors.surface2 }]}>
      <Text variant="footnote" style={[styles.bold, { color: colors.ink }]} numberOfLines={1}>
        {quote.author}
      </Text>
      <Text variant="footnote" tone="inkSoft" numberOfLines={2}>
        {quote.text}
      </Text>
    </Pressable>
  );
}

export const MessageBubble = memo(function MessageBubble({
  message,
  mine,
  showAuthor,
  face = 'none',
  tail = false,
  startsGroup = false,
  readState,
  quote,
  origin,
  hasThread,
  onLongPress,
  onReply,
  onQuotePress,
  onReact,
  onOpenThread,
  agent = null,
  agentTag = false,
}: {
  message: Message;
  mine: boolean;
  showAuthor: boolean;
  face?: AuthorFace;
  tail?: boolean;
  startsGroup?: boolean;
  readState: ReadState | null;
  quote: Quote;
  origin: string;
  hasThread: boolean;
  onLongPress: (message: Message) => void;
  onReply?: (message: Message) => void;
  onQuotePress: (id: number) => void;
  onReact: (message: Message, content: string) => void;
  onOpenThread: (message: Message) => void;
  agent?: CardStore<number, AgentCard> | null;
  agentTag?: boolean;
}) {
  const { t, i18n } = useTranslation('chat');
  const { colors } = useTheme();
  const { clock } = useChatFormat();
  const hold = useCallback(() => {
    haptic.start();
    onLongPress(message);
  }, [onLongPress, message]);
  const removed = isRemoved(message);
  const shownBody = message.translated && message.translation ? message.translation.body : message.body;
  const blocks = removed ? [] : bodyBlocks(shownBody);
  const notification = message.type === 'notification';
  const time = clock(message.date);
  const rich = removed ? undefined : message.rich;
  const text = rich ? richLabel(t, rich) : bodyPreview(message.body);
  if (isCallNotice(message)) {
    const call = message.call;
    const key = callNoticeKey(call, mine);
    const minutes = key === 'thread.call' && call ? t('thread.callMinutes', { count: Math.max(1, call.minutes) }) : null;
    const label = [t(key), minutes, time].filter(Boolean).join(' · ');
    return (
      <View style={[styles.notice, styles.callRow]} accessible={!call?.ongoing} accessibilityLabel={label} testID={`call-notice-${message.id}`}>
        <View style={[styles.noticePill, styles.callNotice, { backgroundColor: colors.surface2 }]} testID={`call-notice-${message.id}-pill`}>
          <Icon name="phone" size={16} color={key === 'thread.callMissed' ? colors.danger : colors.inkSoft} />
          <Text variant="footnote" tone="inkSoft">
            {label}
          </Text>
          {call?.ongoing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('thread.callJoin')}
              style={styles.join}
              onPress={() => {
                const live = callState();
                const busy = live.phase !== 'idle' && live.phase !== 'ended';
                router.push({ pathname: '/call/[id]', params: { id: String(busy ? live.channelId : message.channelId) } });
                if (!busy) void startCall({ channelId: message.channelId, channelName: conversationById(getChat(), message.channelId)?.name ?? '' });
              }}
              testID={`call-notice-${message.id}-join`}>
              <Text variant="footnote" tone="link">
                {t('thread.callJoin')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }
  if (notification) {
    return (
      <View style={styles.notice}>
        <Text variant="footnote" tone="inkSoft" style={[styles.center, styles.noticePill, { backgroundColor: colors.surface2 }]}>
          {message.author && !text.startsWith(message.author) ? `${message.author} ` : ''}
          {text}
        </Text>
      </View>
    );
  }
  const labelKey = `${i18n.language}|${mine}|${readState}|${time}`;
  const known = labels.get(message);
  const label =
    known?.key === labelKey
      ? known.label
      : remember(message, labelKey, [
          mine ? t('thread.you') : message.author,
          removed ? t('thread.removed') : text,
          message.attachments.length ? t('list.files', { count: message.attachments.length }) : '',
          message.edited && !removed ? t('thread.edited') : '',
          message.urgent ? t('thread.urgent') : '',
          message.pinnedAt ? t('thread.pinned') : '',
          message.starred ? t('thread.starred') : '',
          time,
          readState === 'read' ? t('thread.read') : readState === 'sent' ? t('thread.sent') : '',
        ]);
  const frame = (
      <Frame mine={mine} onLongPress={hold} label={label} testID={`bubble-${message.id}`} tail={tail} bare={rich !== undefined && 'sticker' in rich && !quote} interactive={rich !== undefined && ('poll' in rich || 'location' in rich)}>
        {(showAuthor || (agent && agentTag)) && !mine ? (
          <View style={styles.authorRow}>
            {showAuthor ? (
              <Text variant="footnote" numberOfLines={1} style={[styles.bold, styles.authorName, { color: colors.ink }]}>
                {message.author}
              </Text>
            ) : null}
            {agent && agentTag ? (
              <View style={[styles.agentTag, { backgroundColor: colors.infoBand }]} testID={`agent-tag-${message.id}`}>
                <Icon name="sparkle" size={12} color={colors.infoInk} />
                <Text variant="label" tone="infoInk">
                  {t('thread.agentTag')}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <QuoteBlock quote={quote} mine={mine} onPress={message.parentId ? () => onQuotePress(message.parentId as number) : undefined} />
        <Attachments attachments={message.attachments} origin={origin} mine={mine} meta={{ title: message.author, channelId: message.channelId, messageId: message.id }} />
        {rich ? (
          'poll' in rich ? (
            <PollCard message={message} poll={rich.poll} mine={mine} onLongPress={hold} />
          ) : 'location' in rich ? (
            <LocationCard message={message} place={rich.location} mine={mine} onLongPress={hold} />
          ) : (
            <RichMedia rich={rich} origin={origin} messageId={message.id} testID={`rich-${message.id}`} />
          )
        ) : agent && !removed && !message.translated ? (
          <AgentSaid store={agent} messageId={message.id}>
            {blocks.length ? <RichText blocks={blocks} color={colors.ink} tint={colors.surface2} onLongPress={hold} /> : null}
          </AgentSaid>
        ) : blocks.length ? (
          <RichText blocks={blocks} color={mine ? colors.selectInk : colors.ink} tint={mine ? colors.surface : colors.surface2} onLongPress={hold} />
        ) : null}
        {message.translated && message.translation ? (
          <Text variant="label" tone="inkFaint" testID={`translated-${message.id}`}>
            {message.translation.lang ? t('thread.translatedFrom', { lang: message.translation.lang }) : t('thread.translated')}
          </Text>
        ) : null}
        {removed ? (
          <Text variant="callout" tone="inkSoft" style={styles.removed} testID={`removed-${message.id}`}>
            {t('thread.removed')}
          </Text>
        ) : null}
        <View style={styles.meta}>
          {message.urgent ? <Icon name="alert" size={16} color={colors.warnInk} /> : null}
          {message.pinnedAt ? <Icon name="pin" size={16} color={colors.inkFaint} /> : null}
          {message.starred ? <Icon name="star" size={16} color={colors.inkFaint} /> : null}
          {message.edited && !removed ? (
            <Text variant="label" tone="inkFaint" style={styles.time} testID={`edited-${message.id}`}>
              {t('thread.edited')}
            </Text>
          ) : null}
          <Text variant="label" tone="inkFaint" style={styles.time}>
            {time}
          </Text>
          {readState ? <Icon name={readState === 'read' ? 'checkDouble' : 'check'} size={16} color={readState === 'read' ? colors.primary : colors.inkFaint} /> : null}
        </View>
      </Frame>
  );
  const under =
      message.reactions.length || hasThread ? (
        <View style={[styles.under, mine ? styles.wrapMine : styles.wrapTheirs]} pointerEvents="box-none">
          {message.reactions.map((reaction) => (
            <Pressable
              key={reaction.content}
              accessibilityRole="button"
              accessibilityLabel={t('thread.reaction', { emoji: reaction.content, count: reaction.count })}
              accessibilityState={{ selected: reaction.mine }}
              onPress={() => onReact(message, reaction.content)}
              hitSlop={reactionSlop}
              style={[styles.reaction, { backgroundColor: reaction.mine ? colors.select : colors.surface, borderColor: reaction.mine ? colors.focus : colors.line }]}>
              <Text variant="footnote">
                {reaction.content} {reaction.count}
              </Text>
            </Pressable>
          ))}
          {hasThread ? (
            <Pressable accessibilityRole="button" onPress={() => onOpenThread(message)} hitSlop={reactionSlop} style={[styles.reaction, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Icon name="thread" size={16} color={colors.link} />
              <Text variant="footnote" style={{ color: colors.link }}>
                {t('thread.openSubThread')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null;
  const swipeable = (row: ReactNode) =>
    onReply && !removed ? (
      <SwipeReply message={message} onReply={onReply}>
        {row}
      </SwipeReply>
    ) : (
      row
    );
  return swipeable(
    <MessageLane
      mine={mine}
      indent={face !== 'none'}
      startsGroup={startsGroup}
      after={under}
      testID={`message-${message.id}`}
      face={
        face === 'show' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('thread.openPerson', { name: message.author })}
          disabled={!message.authorId}
          onPress={() => message.authorId && router.push({ pathname: '/person/[id]', params: { id: String(message.authorId), name: message.author } })}
          hitSlop={faceSlop}
          testID={`message-${message.id}-author`}>
          <Avatar name={message.author} seed={message.authorId ?? 0} partnerId={message.authorId} size={faceSize} />
        </Pressable>
        ) : undefined
      }>
      {frame}
    </MessageLane>,
  );
});

function PendingFileRow({ file }: { file: PendingFile }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { duration } = useChatFormat();
  const progress = useUploadProgress(file.key);
  const name = file.voice ? t('composer.voiceLength', { length: duration(file.durationMs ?? 0) }) : file.name;
  return (
    <View style={[styles.file, styles.pendingFile, { backgroundColor: colors.surface }]}>
      <Icon name={file.voice ? 'mic' : file.mimetype.startsWith('image/') ? 'image' : 'file'} color={colors.inkSoft} />
      {progress === null ? (
        <Text variant="callout" numberOfLines={1} style={styles.flex}>
          {name}
        </Text>
      ) : (
        <View style={styles.flex}>
          <UploadProgress name={name} sent={progress} testID="pending-progress" />
        </View>
      )}
    </View>
  );
}

function PendingRich({ rich, channelId, origin }: { rich: Rich; channelId: number; origin: string }) {
  const message = { id: 0, channelId };
  if ('poll' in rich) return <PollCard message={message} poll={rich.poll} mine pending />;
  if ('location' in rich) return <LocationCard message={message} place={rich.location} mine pending />;
  return <RichMedia rich={rich} origin={origin} testID="pending-rich" />;
}

export const PendingBubble = memo(function PendingBubble({
  pending,
  offline,
  origin,
  onRetry,
  onDiscard,
}: {
  pending: Pending;
  offline: boolean;
  origin: string;
  onRetry: (key: string) => void;
  onDiscard: (key: string) => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const failed = pending.state === 'failed';
  const status = failed ? t('thread.failed') : offline && pending.state === 'queued' ? t('thread.queued') : t('thread.waiting');
  const label = [pending.rich ? richLabel(t, pending.rich) : pending.text, status].filter(Boolean).join(', ');
  return (
    <View style={[styles.wrap, styles.wrapMine]} testID={`pending-${pending.state}`}>
      <Frame mine label={label} failed={failed} testID="bubble-pending" tail bare={pending.rich !== undefined && 'sticker' in pending.rich}>
        {pending.rich ? <PendingRich rich={pending.rich} channelId={pending.channelId} origin={origin} /> : null}
        {pending.files.map((file) => (
          <PendingFileRow key={file.key} file={file} />
        ))}
        {pending.text ? <RichText blocks={sourceBlocks(pending.text, false)} color={colors.selectInk} tint={colors.surface} /> : null}
        <View style={styles.meta}>
          <Text variant="label" tone={failed ? 'dangerInk' : 'inkFaint'}>
            {status}
          </Text>
          <Icon name={failed ? 'alert' : 'clock'} size={16} color={failed ? colors.dangerInk : colors.inkFaint} />
        </View>
      </Frame>
      {failed ? (
        <View style={[styles.failedActions, styles.wrapMine]}>
          <Pressable accessibilityRole="button" onPress={() => onRetry(pending.key)} style={[styles.action, { borderColor: colors.line }]} testID="pending-retry">
            <Icon name="retry" size={16} color={colors.link} />
            <Text variant="footnote" style={{ color: colors.link }}>
              {t('thread.retry')}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => onDiscard(pending.key)} style={[styles.action, { borderColor: colors.line }]}>
            <Icon name="trash" size={16} color={colors.dangerInk} />
            <Text variant="footnote" tone="dangerInk">
              {t('thread.discard')}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
});

const callTouch = 48;
const callLine = typography.footnote.lineHeight;
const joinBand = Math.ceil((callTouch - callLine) / 2);
const callRowPad = Math.max(space.sm, Math.ceil((callTouch - callLine - 2 * space.xs) / 2));

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '600' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  authorName: { flexShrink: 1 },
  agentTag: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.xs, borderRadius: radius.sm },
  wrap: { paddingHorizontal: space.lg, marginTop: space.xs, width: '100%', maxWidth: readableWidth + 2 * space.lg, alignSelf: 'center' },
  groupStart: { marginTop: space.sm },
  wrapMine: { alignItems: 'flex-end' },
  wrapTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: '80%', minWidth: 88, borderRadius: radius.card, borderWidth: stroke.thin, paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
  bare: { backgroundColor: 'transparent', borderColor: 'transparent', paddingHorizontal: 0, minWidth: 0 },
  plain: { borderWidth: 0 },
  barePressed: { opacity: 0.7 },
  tail: { position: 'absolute', bottom: 0 },
  tailTheirs: { left: -tailReach },
  tailMine: { right: -tailReach, transform: [{ scaleX: -1 }] },
  quoteBox: { minHeight: touchTarget, justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  attachments: { gap: space.xs },
  file: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, minHeight: 48, width: 260, maxWidth: '100%' },
  pendingFile: { minWidth: 200 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  time: { fontWeight: '400' },
  removed: { fontStyle: 'italic' },
  under: { flexDirection: 'row', flexWrap: 'wrap', columnGap: reactionGap, rowGap: reactionSlop.top + reactionSlop.bottom, paddingTop: reactionSlop.top, paddingBottom: reactionSlop.bottom },
  failedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  reaction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: reactionHeight, minWidth: touchTarget, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: stroke.thin },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: stroke.thin },
  notice: { paddingHorizontal: space.xxl, paddingVertical: space.sm, alignItems: 'center' },
  noticePill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.md, overflow: 'hidden' },
  callNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs, overflow: 'visible' },
  callRow: { paddingVertical: callRowPad },
  join: { paddingVertical: joinBand, marginVertical: -joinBand, paddingHorizontal: space.sm, marginHorizontal: -space.sm },
  withFace: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  afterFace: { paddingLeft: faceSize + space.md },
  faceSpace: { width: faceSize },
  faceColumn: { flex: 1, alignItems: 'flex-start' },
});
