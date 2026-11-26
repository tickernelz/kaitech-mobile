import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, PixelRatio, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../../../../theme';
import { Icon, type IconName } from '../../../../ui/icons';
import { Pressable } from '../../../../ui/Pressable';
import { Text } from '../../../../ui/Text';
import { cancelFile, DownloadCancelled, useFileStatus } from '../../media/download';
import { cacheFile, discardLate, epochOf, previewPath, rememberMeta, useMediaMeta } from '../../media/meta';
import { nativeMedia } from '../../media/native';
import { previewWidth } from '../../media/preview';
import { pdfSession, type PdfSession } from '../../media/viewer';
import { useChatFormat } from '../format';
import { fetchAttachment, fileKey, fileName, presentFile, shareFile } from '../useOpenAttachment';
import { ProgressRing } from './ProgressRing';
import { Zoomable } from './Zoomable';

const pageGap = space.sm;

type Opened = { uri: string; pages: number; ratio: number };

function renderWidth(width: number): number {
  return Math.min(1600, Math.round(width * PixelRatio.get()));
}

async function openPdf(session: PdfSession, uri: string): Promise<Opened> {
  const media = nativeMedia();
  if (!media) throw new Error('unavailable');
  const epoch = epochOf(session.accountId);
  const relative = previewPath(session.accountId, session.attachment, 'page-1.jpg');
  const first = await media.renderPdfPage(uri, 0, previewWidth, cacheFile(relative).uri);
  if (discardLate(session.accountId, epoch, relative)) throw new Error('forgotten');
  rememberMeta(session.accountId, session.attachment, { pages: first.pages, width: first.width, height: first.height, preview: relative }, epoch);
  return { uri, pages: first.pages, ratio: first.height / first.width };
}

const PdfPage = memo(function PdfPage({ session, source, page, width, ratio }: { session: PdfSession; source: string; page: number; width: number; ratio: number }) {
  const { colors } = useTheme();
  const target = renderWidth(width);
  const relative = previewPath(session.accountId, session.attachment, `page-${page + 1}-${target}.jpg`);
  const [shown, setShown] = useState<{ uri: string; ratio: number } | null>(() => {
    const file = cacheFile(relative);
    return file.exists ? { uri: file.uri, ratio } : null;
  });
  useEffect(() => {
    if (shown) return;
    let live = true;
    const epoch = epochOf(session.accountId);
    void nativeMedia()
      ?.renderPdfPage(source, page, target, cacheFile(relative).uri)
      .then((out) => {
        if (discardLate(session.accountId, epoch, relative)) return;
        if (live) setShown({ uri: cacheFile(relative).uri, ratio: out.height / out.width });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [shown, source, page, target, relative, session.accountId]);
  const height = Math.round(width * (shown?.ratio ?? ratio));
  return (
    <View style={{ width, height, marginBottom: pageGap, backgroundColor: colors.onStage }} testID={`pdf-page-${page + 1}`}>
      {shown ? (
        <Zoomable width={width} height={height}>
          <Image source={{ uri: shown.uri }} style={{ width, height }} resizeMode="contain" />
        </Zoomable>
      ) : (
        <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.inkSoft} />
      )}
    </View>
  );
});

function Bar({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={onPress} testID={testID} style={styles.barButton}>
      <Icon name={icon} color={colors.onStage} />
    </Pressable>
  );
}

export function PdfViewer() {
  const [session] = useState(pdfSession);
  useEffect(() => {
    if (!session) router.back();
  }, [session]);
  return session ? <PdfDocument session={session} /> : null;
}

function PdfDocument({ session }: { session: PdfSession }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { size } = useChatFormat();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const attachment = session.attachment;
  const meta = useMediaMeta(session.accountId, attachment);
  const status = useFileStatus(fileKey(session.accountId, attachment), fileName(attachment));
  const [opened, setOpened] = useState<Opened | null>(null);
  const [failure, setFailure] = useState<'download' | 'unreadable' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(1);
  const viewable = useCallback(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    const first = viewableItems[0]?.index;
    if (typeof first === 'number') setPage(first + 1);
  }, []);
  const pageWidth = width - 2 * space.sm;
  useEffect(() => {
    let live = true;
    void fetchAttachment(session.attachment)
      .then(async (file) => {
        if (!file || !live) return;
        try {
          const next = await openPdf(session, file.uri);
          if (live) setOpened(next);
        } catch {
          if (live) setFailure('unreadable');
        }
      })
      .catch((error) => {
        if (!live) return;
        if (error instanceof DownloadCancelled) router.back();
        else setFailure('download');
      });
    return () => {
      live = false;
    };
  }, [session, attempt]);
  const handOff = (share: boolean) =>
    void fetchAttachment(attachment)
      .then((file) => (file ? (share ? shareFile(attachment, file.uri, t) : presentFile(attachment, file, t)) : undefined))
      .catch(() => undefined);
  const pages = opened?.pages ?? meta.pages ?? 0;
  return (
    <View style={[styles.flex, { backgroundColor: colors.stage }]} testID="pdf-viewer">
      <StatusBar style="light" />
      <View style={[styles.top, { paddingTop: insets.top + space.xs }]}>
        <Bar icon="close" label={t('media.close')} onPress={() => router.back()} testID="pdf-close" />
        <View style={styles.title}>
          <Text variant="headline" numberOfLines={1} style={{ color: colors.onStage }}>
            {attachment.name}
          </Text>
          {pages ? (
            <Text variant="footnote" style={{ color: colors.onStage }} testID="pdf-page-counter">
              {t('media.page', { page, count: pages })}
            </Text>
          ) : null}
        </View>
        <Bar icon="external" label={t('media.openElsewhere')} onPress={() => handOff(false)} testID="pdf-open-elsewhere" />
        <Bar icon="share" label={t('media.share')} onPress={() => handOff(true)} testID="pdf-share" />
      </View>
      {opened ? (
        <FlatList
          data={Array.from({ length: opened.pages }, (_, index) => index)}
          keyExtractor={(index) => String(index)}
          contentContainerStyle={[styles.pages, { paddingBottom: insets.bottom + space.lg }]}
          windowSize={5}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          onViewableItemsChanged={viewable}
          viewabilityConfig={{ itemVisiblePercentThreshold: 40 }}
          renderItem={({ item }) => <PdfPage session={session} source={opened.uri} page={item} width={pageWidth} ratio={opened.ratio} />}
        />
      ) : failure ? (
        <View style={styles.center} testID={`pdf-${failure}`}>
          <Icon name="alert" color={colors.onStage} />
          <Text variant="callout" style={[styles.centerText, { color: colors.onStage }]}>
            {failure === 'unreadable' ? t('media.pdfFailed') : t('media.failed')}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (failure === 'unreadable') {
                handOff(false);
                return;
              }
              setFailure(null);
              setAttempt((value) => value + 1);
            }}
            testID="pdf-recover"
            style={[styles.pill, { backgroundColor: colors.onStage }]}>
            <Icon name={failure === 'unreadable' ? 'external' : 'retry'} size={20} color={colors.stage} />
            <Text variant="callout" style={{ color: colors.stage }}>
              {failure === 'unreadable' ? t('media.openElsewhere') : t('media.retry', { name: attachment.name })}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.center} testID="pdf-loading">
          {status.state === 'downloading' ? (
            <>
              <ProgressRing received={status.received} total={status.total} size={56} color={colors.onStage} track={colors.stageScrim} />
              <Text variant="callout" style={{ color: colors.onStage }}>
                {status.total > 0 ? t('media.progress', { received: size(status.received), total: size(status.total) }) : t('media.downloadingPdf')}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => cancelFile(fileKey(session.accountId, attachment), fileName(attachment))}
                testID="pdf-cancel"
                style={[styles.pill, { backgroundColor: colors.onStage }]}>
                <Icon name="close" size={20} color={colors.stage} />
                <Text variant="callout" style={{ color: colors.stage }}>
                  {t('media.cancel', { name: attachment.name })}
                </Text>
              </Pressable>
            </>
          ) : (
            <ActivityIndicator color={colors.onStage} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingBottom: space.sm },
  title: { flex: 1, minWidth: 0 },
  barButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pages: { paddingHorizontal: space.sm, paddingTop: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  centerText: { textAlign: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
});
