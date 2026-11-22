import { router } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { readableWidth } from '../../../layout/windowClass';
import { personColors, radius, space, useTheme, type Colors, type Scheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { bodyBlocks, bodyPreview, sourceBlocks } from '../markdown';
import { attachmentUrl, isCallNotice, isRemoved, type ReadState } from '../odoo';
import { useUploadProgress } from '../progress';
import type { Attachment, Message, Pending, PendingFile } from '../types';
import { useChatFormat } from './format';
import { Icon } from '../../../ui/icons';
import { UploadProgress } from './MediaControls';
import { RichText } from './RichText';
import { useCookie } from './useCookie';
import { useOpenAttachment } from './useOpenAttachment';
import { VoiceNote } from './VoiceNote';
import { recordingIdOf } from '../../call/recording';
import { RecordingCard } from '../../call/ui/RecordingCard';
import { callState, startCall } from '../../call/call';
import { conversationById, getChat } from '../chat';
import { Avatar } from './Avatar';
import { AgentSaid } from './coworker/Cards';
import type { AgentCard, CardStore } from '../coworker';

export type AuthorFace = 'show' | 'space' | 'none';
export const faceSize = 32;

export const bubbleMaxWidth = Math.round(readableWidth * 0.8);

function ShareButton({ name, onPress, raised }: { name: string; onPress: () => void; raised?: boolean }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('thread.share', { name })}
      hitSlop={8}
      onPress={onPress}
      testID="attachment-share"
      style={({ pressed }) => [styles.share, raised && { backgroundColor: colors.surface }, { opacity: pressed ? 0.7 : 1 }]}>
      <Icon name="share" size={20} color={colors.inkSoft} />
    </Pressable>
  );
}

function FileChip({ attachment, mine }: { attachment: Attachment; mine: boolean }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { size } = useChatFormat();
  const { open, share, opening } = useOpenAttachment();
  const busy = opening === attachment.id;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('thread.openFile', { name: attachment.name })}
      accessibilityState={{ busy }}
      accessibilityActions={[{ name: 'share', label: t('thread.share', { name: attachment.name }) }]}
      onAccessibilityAction={() => void share(attachment)}
      onPress={() => void open(attachment)}
      style={({ pressed }) => [styles.file, { backgroundColor: mine ? colors.surface : colors.surface2, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.fileIcon, { backgroundColor: colors.dangerBand }]}>
        {busy ? <ActivityIndicator color={colors.dangerInk} /> : <Icon name="file" color={colors.dangerInk} />}
      </View>
      <View style={styles.fileText}>
        <Text variant="callout" numberOfLines={2} style={styles.bold}>
          {attachment.name}
        </Text>
        <Text variant="footnote" tone="inkSoft">
          {size(attachment.size)}
        </Text>
      </View>
      <ShareButton name={attachment.name} onPress={() => void share(attachment)} />
    </Pressable>
  );
}

function Picture({ attachment, origin }: { attachment: Attachment; origin: string }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const uri = attachmentUrl(origin, attachment);
  const cookie = useCookie();
  const { open, share, opening } = useOpenAttachment();
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={t('thread.openImage', { name: attachment.name })}
      accessibilityState={{ busy: opening === attachment.id }}
      accessibilityActions={[{ name: 'share', label: t('thread.share', { name: attachment.name }) }]}
      onAccessibilityAction={() => void share(attachment)}
      onPress={() => void open(attachment)}>
      <Image source={{ uri, ...(cookie ? { headers: cookie } : {}) }} style={[styles.picture, { backgroundColor: colors.surface2 }]} resizeMode="cover" />
      <View style={styles.pictureShare}>
        <ShareButton name={attachment.name} onPress={() => void share(attachment)} raised />
      </View>
    </Pressable>
  );
}

export function Attachments({ attachments, origin, mine }: { attachments: Attachment[]; origin: string; mine: boolean }) {
  if (!attachments.length) return null;
  return (
    <View style={styles.attachments}>
      {attachments.map((attachment) => {
        const recordingId = recordingIdOf(attachment.url);
        return recordingId !== null ? (
          <RecordingCard key={attachment.id} recordingId={recordingId} mine={mine} />
        ) : attachment.voice || attachment.mimetype.startsWith('audio/') ? (
          <VoiceNote key={attachment.id} id={`a${attachment.id}`} uri={attachmentUrl(origin, attachment)} mine={mine} seed={attachment.id} />
        ) : attachment.mimetype.startsWith('image/') ? (
          <Picture key={attachment.id} attachment={attachment} origin={origin} />
        ) : (
          <FileChip key={attachment.id} attachment={attachment} mine={mine} />
        );
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
}: {
  mine: boolean;
  children: ReactNode;
  onLongPress?: () => void;
  label: string;
  testID?: string;
  failed?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityLabel={label}
      accessibilityHint={onLongPress ? undefined : undefined}
      accessibilityActions={onLongPress ? [{ name: 'longpress' }] : undefined}
      onAccessibilityAction={onLongPress ? () => onLongPress() : undefined}
      testID={testID}
      style={[
        styles.bubble,
        mine ? styles.mine : styles.theirs,
        {
          backgroundColor: mine ? colors.select : colors.surface,
          borderColor: failed ? colors.danger : mine ? colors.select : colors.line,
        },
      ]}>
      {children}
    </Pressable>
  );
}

export type Quote = { author: string; authorId: number | null; text: string } | null;

export function authorColor(authorId: number | null, scheme: Scheme, colors: Colors): string {
  return authorId === null ? colors.link : personColors(authorId, scheme).name;
}

function QuoteBlock({ quote, mine, onPress }: { quote: Quote; mine: boolean; onPress?: () => void }) {
  const { colors, scheme } = useTheme();
  if (!quote) return null;
  const tint = authorColor(quote.authorId, scheme, colors);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={[styles.quoteBox, { backgroundColor: mine ? colors.surface : colors.surface2 }]}>
      <Text variant="footnote" style={[styles.bold, { color: tint }]} numberOfLines={1}>
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
  readState,
  quote,
  origin,
  hasThread,
  onLongPress,
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
  readState: ReadState | null;
  quote: Quote;
  origin: string;
  hasThread: boolean;
  onLongPress: (message: Message) => void;
  onQuotePress: (id: number) => void;
  onReact: (message: Message, content: string) => void;
  onOpenThread: (message: Message) => void;
  agent?: CardStore<number, AgentCard> | null;
  agentTag?: boolean;
}) {
  const { t } = useTranslation('chat');
  const { colors, scheme } = useTheme();
  const { clock } = useChatFormat();
  const removed = isRemoved(message);
  const shownBody = message.translated && message.translation ? message.translation.body : message.body;
  const blocks = removed ? [] : bodyBlocks(shownBody);
  const notification = message.type === 'notification';
  const time = clock(message.date);
  const text = bodyPreview(message.body);
  if (isCallNotice(message)) {
    const call = message.call;
    const label = [t(call?.ongoing ? 'thread.callOngoing' : 'thread.call'), call && !call.ongoing ? t('thread.callMinutes', { count: Math.max(1, call.minutes) }) : null, time].filter(Boolean).join(' · ');
    return (
      <View style={styles.notice} accessible={!call?.ongoing} accessibilityLabel={label} testID={`call-notice-${message.id}`}>
        <View style={[styles.noticePill, styles.callNotice, { backgroundColor: colors.surface2 }]}>
          <Icon name="phone" size={16} color={colors.inkSoft} />
          <Text variant="footnote" tone="inkSoft">
            {label}
          </Text>
          {call?.ongoing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('thread.callJoin')}
              hitSlop={8}
              onPress={() => {
                const live = callState();
                const busy = live.phase !== 'idle' && live.phase !== 'ended';
                router.push({ pathname: '/call/[id]', params: { id: String(busy ? live.channelId : message.channelId) } });
                if (!busy) void startCall({ channelId: message.channelId, channelName: conversationById(getChat(), message.channelId)?.name ?? '', video: false });
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
  const label = [
    mine ? t('thread.you') : message.author,
    removed ? t('thread.removed') : text,
    message.attachments.length ? t('list.files', { count: message.attachments.length }) : '',
    message.edited && !removed ? t('thread.edited') : '',
    message.urgent ? t('thread.urgent') : '',
    message.pinnedAt ? t('thread.pinned') : '',
    message.starred ? t('thread.starred') : '',
    time,
    readState === 'read' ? t('thread.read') : readState === 'sent' ? t('thread.sent') : '',
  ]
    .filter(Boolean)
    .join(', ');
  const body = (
    <>
      <Frame mine={mine} onLongPress={() => onLongPress(message)} label={label}>
        {(showAuthor || (agent && agentTag)) && !mine ? (
          <View style={styles.authorRow}>
            {showAuthor ? (
              <Text variant="footnote" numberOfLines={1} style={[styles.bold, styles.authorName, { color: authorColor(message.authorId, scheme, colors) }]}>
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
        <Attachments attachments={message.attachments} origin={origin} mine={mine} />
        {agent && !removed && !message.translated ? (
          <AgentSaid store={agent} messageId={message.id}>
            {blocks.length ? <RichText blocks={blocks} color={colors.ink} tint={colors.surface2} /> : null}
          </AgentSaid>
        ) : blocks.length ? (
          <RichText blocks={blocks} color={mine ? colors.selectInk : colors.ink} tint={mine ? colors.surface : colors.surface2} />
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
      {message.reactions.length || hasThread ? (
        <View style={[styles.under, mine ? styles.wrapMine : styles.wrapTheirs]}>
          {message.reactions.map((reaction) => (
            <Pressable
              key={reaction.content}
              accessibilityRole="button"
              accessibilityLabel={t('thread.reaction', { emoji: reaction.content, count: reaction.count })}
              accessibilityState={{ selected: reaction.mine }}
              onPress={() => onReact(message, reaction.content)}
              style={[styles.reaction, { backgroundColor: reaction.mine ? colors.select : colors.surface, borderColor: reaction.mine ? colors.focus : colors.line }]}>
              <Text variant="footnote">
                {reaction.content} {reaction.count}
              </Text>
            </Pressable>
          ))}
          {hasThread ? (
            <Pressable accessibilityRole="button" onPress={() => onOpenThread(message)} style={[styles.reaction, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Icon name="thread" size={16} color={colors.link} />
              <Text variant="footnote" style={{ color: colors.link }}>
                {t('thread.openSubThread')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );
  if (face === 'none' || mine) {
    return (
      <View style={[styles.wrap, mine ? styles.wrapMine : styles.wrapTheirs]} testID={`message-${message.id}`}>
        {body}
      </View>
    );
  }
  return (
    <View style={[styles.wrap, styles.withFace]} testID={`message-${message.id}`}>
      {face === 'show' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('thread.openPerson', { name: message.author })}
          disabled={!message.authorId}
          onPress={() => message.authorId && router.push({ pathname: '/person/[id]', params: { id: String(message.authorId), name: message.author } })}
          testID={`message-${message.id}-author`}>
          <Avatar name={message.author} seed={message.authorId ?? 0} partnerId={message.authorId} size={faceSize} />
        </Pressable>
      ) : (
        <View style={styles.faceSpace} />
      )}
      <View style={styles.faceColumn}>{body}</View>
    </View>
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

export const PendingBubble = memo(function PendingBubble({
  pending,
  offline,
  onRetry,
  onDiscard,
}: {
  pending: Pending;
  offline: boolean;
  onRetry: (key: string) => void;
  onDiscard: (key: string) => void;
}) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const failed = pending.state === 'failed';
  const status = failed ? t('thread.failed') : offline && pending.state === 'queued' ? t('thread.queued') : t('thread.waiting');
  const label = [pending.text, status].filter(Boolean).join(', ');
  return (
    <View style={[styles.wrap, styles.wrapMine]} testID={`pending-${pending.state}`}>
      <Frame mine label={label} failed={failed}>
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
        <View style={[styles.under, styles.wrapMine]}>
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  bold: { fontWeight: '600' },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  authorName: { flexShrink: 1 },
  agentTag: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: space.xs, borderRadius: radius.sm },
  wrap: { paddingHorizontal: space.lg, marginTop: 2, maxWidth: '100%' },
  wrapMine: { alignItems: 'flex-end' },
  wrapTheirs: { alignItems: 'flex-start' },
  bubble: { maxWidth: bubbleMaxWidth, minWidth: 88, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.xs },
  mine: { borderBottomRightRadius: radius.sm },
  theirs: { borderBottomLeftRadius: radius.sm },
  quoteBox: { borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  attachments: { gap: space.xs },
  file: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, minHeight: 48, width: 260, maxWidth: '100%' },
  fileText: { flexShrink: 1, flexGrow: 1 },
  pendingFile: { minWidth: 200 },
  fileIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  picture: { width: 240, maxWidth: '100%', aspectRatio: 4 / 3, borderRadius: radius.md },
  pictureShare: { position: 'absolute', right: space.xs, bottom: space.xs },
  share: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  time: { fontWeight: '400' },
  removed: { fontStyle: 'italic' },
  under: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth },
  notice: { paddingHorizontal: space.xxl, paddingVertical: space.sm, alignItems: 'center' },
  noticePill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.md, overflow: 'hidden' },
  callNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  withFace: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingLeft: space.sm },
  faceSpace: { width: faceSize },
  faceColumn: { flexShrink: 1, alignItems: 'flex-start' },
});
