import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, PixelRatio, StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../../../theme';
import type { ColorName } from '../../../../theme/tokens';
import { Icon, type IconName } from '../../../../ui/icons';
import { Pressable } from '../../../../ui/Pressable';
import { Text } from '../../../../ui/Text';
import { useChat } from '../../chat';
import { cancelFile, useFileStatus, type FileStatus } from '../../media/download';
import { clock, extensionOf, fileFamily, mediaKind, tileSize, wrappableName, type FileFamily } from '../../media/kind';
import { cacheFile, rememberMeta, useMediaMeta } from '../../media/meta';
import { wantPreview } from '../../media/preview';
import { imageUrl, serverPdfThumbnail } from '../../media/urls';
import type { Attachment } from '../../types';
import { useChatFormat } from '../format';
import { useCookie } from '../useCookie';
import { fetchAttachment, fileKey, fileName, presentFile, useOpenAttachment } from '../useOpenAttachment';
import { useOpenMedia } from './gallery';
import { ProgressRing } from './ProgressRing';

type TileProps = { attachment: Attachment; origin: string; width: number; onOpen: () => void };

const families: Record<FileFamily, { icon: IconName; band: ColorName; ink: ColorName }> = {
  pdf: { icon: 'doc', band: 'dangerBand', ink: 'dangerInk' },
  doc: { icon: 'doc', band: 'infoBand', ink: 'infoInk' },
  sheet: { icon: 'table', band: 'okBand', ink: 'okInk' },
  slides: { icon: 'slides', band: 'warnBand', ink: 'warnInk' },
  archive: { icon: 'zip', band: 'select', ink: 'selectInk' },
  text: { icon: 'doc', band: 'surface2', ink: 'inkSoft' },
  audio: { icon: 'speaker', band: 'select', ink: 'selectInk' },
  image: { icon: 'image', band: 'select', ink: 'selectInk' },
  video: { icon: 'video', band: 'select', ink: 'selectInk' },
  other: { icon: 'file', band: 'surface2', ink: 'inkSoft' },
};

function usePreview(attachment: Attachment, origin: string, enabled: boolean) {
  const accountId = useChat((state) => state.accountId);
  const cookie = useCookie();
  const meta = useMediaMeta(accountId, attachment);
  useEffect(() => {
    if (enabled && accountId && cookie && !meta.preview) wantPreview({ accountId, origin, headers: cookie }, attachment);
  }, [enabled, accountId, cookie, meta.preview, origin, attachment]);
  return { accountId, cookie, meta };
}

export const PhotoTile = memo(function PhotoTile({ attachment, origin, width, onOpen }: TileProps) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { share } = useOpenAttachment();
  const accountId = useChat((state) => state.accountId);
  const cookie = useCookie();
  const meta = useMediaMeta(accountId, attachment);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const size = tileSize(meta, width);
  const uri = imageUrl(origin, attachment, size.width * PixelRatio.get());
  return (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={t('thread.openImage', { name: attachment.name })}
      accessibilityActions={[{ name: 'share', label: t('thread.share', { name: attachment.name }) }]}
      onAccessibilityAction={() => void share(attachment)}
      onPress={() => {
        if (!failed) {
          onOpen();
          return;
        }
        setFailed(false);
        setAttempt((value) => value + 1);
      }}
      testID="media-photo"
      style={[styles.tile, size, { backgroundColor: colors.surface2 }]}>
      {failed ? (
        <View style={styles.center} testID="media-photo-failed">
          <Icon name="retry" color={colors.inkSoft} />
          <Text variant="footnote" tone="inkSoft" style={styles.centerText}>
            {t('media.imageFailed')}
          </Text>
        </View>
      ) : (
        <Image
          key={attempt}
          source={{ uri, ...(cookie ? { headers: cookie } : {}) }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
          testID="media-photo-image"
          onLoad={(event) => {
            const loaded = event.nativeEvent.source;
            if (accountId && !meta.width && loaded?.width && loaded.height) rememberMeta(accountId, attachment, { width: loaded.width, height: loaded.height });
          }}
        />
      )}
    </Pressable>
  );
});

export const VideoTile = memo(function VideoTile({ attachment, origin, width, onOpen }: TileProps) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { size: bytes } = useChatFormat();
  const { meta } = usePreview(attachment, origin, true);
  const size = tileSize(meta, width);
  const preview = meta.preview ? cacheFile(meta.preview).uri : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('media.play', { name: attachment.name })}
      onPress={onOpen}
      testID="media-video"
      style={[styles.tile, size, { backgroundColor: colors.stage }]}>
      {preview ? <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <View style={styles.center}>
        <View style={[styles.play, { backgroundColor: colors.stageScrim }]}>
          <Icon name="play" variant="fill" color={colors.onStage} />
        </View>
      </View>
      <View style={[styles.badge, { backgroundColor: colors.stageScrim }]}>
        <Icon name="video" size={14} color={colors.onStage} />
        <Text variant="label" style={{ color: colors.onStage }} testID="video-duration">
          {meta.durationMs ? clock(meta.durationMs) : bytes(attachment.size)}
        </Text>
      </View>
    </Pressable>
  );
});

function useFileState(attachment: Attachment) {
  const accountId = useChat((state) => state.accountId);
  const key = accountId ? fileKey(accountId, attachment) : null;
  const status = useFileStatus(key, fileName(attachment));
  return { key, status };
}

function Detail({ attachment, status, extra }: { attachment: Attachment; status: FileStatus; extra?: string }) {
  const { t } = useTranslation('chat');
  const { size } = useChatFormat();
  if (status.state === 'failed') {
    return (
      <Text variant="footnote" tone="dangerInk" numberOfLines={2} testID="file-failed">
        {t('media.failed')}
      </Text>
    );
  }
  const amount =
    status.state === 'downloading' && status.total > 0 ? t('media.progress', { received: size(status.received), total: size(status.total) }) : size(attachment.size);
  const parts = [extra, extensionOf(attachment.name), amount].filter(Boolean);
  return (
    <Text variant="footnote" tone="inkSoft" numberOfLines={2}>
      {parts.join(' · ')}
    </Text>
  );
}

function StatusControl({ attachment, status, onDownload, onCancel, onShare }: { attachment: Attachment; status: FileStatus; onDownload: () => void; onCancel: () => void; onShare: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const name = attachment.name;
  if (status.state === 'downloading') {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={t('media.cancel', { name })} hitSlop={8} onPress={onCancel} testID="file-cancel" style={styles.control}>
        <ProgressRing received={status.received} total={status.total} color={colors.primary} track={colors.line} />
        <View style={styles.controlIcon}>
          <Icon name="close" size={16} color={colors.ink} />
        </View>
      </Pressable>
    );
  }
  const [icon, label, onPress, testID]: [IconName, string, () => void, string] =
    status.state === 'done'
      ? ['share', t('thread.share', { name }), onShare, 'attachment-share']
      : status.state === 'failed'
        ? ['retry', t('media.retry', { name }), onDownload, 'file-retry']
        : ['download', t('media.download', { name }), onDownload, 'file-download'];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} testID={testID} style={styles.control}>
      <Icon name={icon} size={20} color={status.state === 'failed' ? colors.dangerInk : colors.inkSoft} />
    </Pressable>
  );
}

function useFileActions(attachment: Attachment) {
  const { t } = useTranslation('chat');
  const { share } = useOpenAttachment();
  const { key, status } = useFileState(attachment);
  return {
    status,
    download: () => void fetchAttachment(attachment).catch(() => undefined),
    downloadAndOpen: () =>
      void fetchAttachment(attachment)
        .then((file) => (file ? presentFile(attachment, file, t) : undefined))
        .catch(() => undefined),
    cancel: () => key && cancelFile(key, fileName(attachment)),
    share: () => void share(attachment, true),
  };
}

export const PdfCard = memo(function PdfCard({ attachment, origin, width, onOpen, mine }: TileProps & { mine: boolean }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { cookie, meta } = usePreview(attachment, origin, true);
  const actions = useFileActions(attachment);
  const local = meta.preview ? cacheFile(meta.preview).uri : null;
  const remote = local ? null : serverPdfThumbnail(origin, attachment);
  const preview = local ?? remote;
  const look = families.pdf;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('media.openPdf', { name: attachment.name })}
      accessibilityActions={[{ name: 'share', label: t('thread.share', { name: attachment.name }) }]}
      onAccessibilityAction={actions.share}
      onPress={onOpen}
      testID="media-pdf"
      style={[styles.card, { width, backgroundColor: mine ? colors.surface : colors.surface2, borderColor: colors.line }]}>
      {preview ? (
        <View style={[styles.page, { backgroundColor: colors.onStage }]}>
          <Image
            source={{ uri: preview, ...(remote && cookie ? { headers: cookie } : {}) }}
            style={{ width, height: meta.width && meta.height ? Math.round((width * meta.height) / meta.width) : Math.round(width * 1.41) }}
            resizeMode="cover"
            testID="pdf-preview"
          />
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={[styles.fileIcon, { backgroundColor: colors[look.band] }]}>
          <Icon name={look.icon} color={colors[look.ink]} />
        </View>
        <View style={styles.fileText}>
          <Text variant="callout" numberOfLines={2} style={styles.bold}>
            {wrappableName(attachment.name)}
          </Text>
          <Detail attachment={attachment} status={actions.status} extra={meta.pages ? t('media.pages', { count: meta.pages }) : undefined} />
        </View>
        <StatusControl attachment={attachment} status={actions.status} onDownload={actions.download} onCancel={actions.cancel} onShare={actions.share} />
      </View>
    </Pressable>
  );
});

export const FileCard = memo(function FileCard({ attachment, width, mine }: { attachment: Attachment; width: number; mine: boolean }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const actions = useFileActions(attachment);
  const { open } = useOpenAttachment();
  const look = families[fileFamily(attachment.name, attachment.mimetype)];
  const onPress = () => {
    if (actions.status.state === 'done') void open(attachment);
    else if (actions.status.state === 'downloading') actions.cancel();
    else actions.downloadAndOpen();
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('thread.openFile', { name: attachment.name })}
      accessibilityState={{ busy: actions.status.state === 'downloading' }}
      accessibilityActions={[{ name: 'share', label: t('thread.share', { name: attachment.name }) }]}
      onAccessibilityAction={actions.share}
      onPress={onPress}
      testID="media-file"
      style={[styles.card, styles.row, { width, backgroundColor: mine ? colors.surface : colors.surface2, borderColor: colors.line }]}>
      <View style={[styles.fileIcon, { backgroundColor: colors[look.band] }]}>
        <Icon name={look.icon} color={colors[look.ink]} />
      </View>
      <View style={styles.fileText}>
        <Text variant="callout" numberOfLines={2} style={styles.bold}>
          {wrappableName(attachment.name)}
        </Text>
        <Detail attachment={attachment} status={actions.status} />
      </View>
      <StatusControl attachment={attachment} status={actions.status} onDownload={actions.download} onCancel={actions.cancel} onShare={actions.share} />
    </Pressable>
  );
});

export function MediaAttachment({ attachment, origin, mine, siblings, width }: { attachment: Attachment; origin: string; mine: boolean; siblings: Attachment[]; width: number }) {
  const openMedia = useOpenMedia();
  const onOpen = () => openMedia(attachment, origin, siblings);
  const kind = mediaKind(attachment);
  if (kind === 'image') return <PhotoTile attachment={attachment} origin={origin} width={width} onOpen={onOpen} />;
  if (kind === 'video') return <VideoTile attachment={attachment} origin={origin} width={width} onOpen={onOpen} />;
  if (kind === 'pdf') return <PdfCard attachment={attachment} origin={origin} width={width} onOpen={onOpen} mine={mine} />;
  return <FileCard attachment={attachment} width={width} mine={mine} />;
}

const styles = StyleSheet.create({
  tile: { borderRadius: radius.md, overflow: 'hidden' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.xs, padding: space.md },
  centerText: { textAlign: 'center' },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', left: space.sm, bottom: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.xs, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  card: { borderRadius: radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  page: { height: 132, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  fileIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  fileText: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
  control: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  controlIcon: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
