import { useEvent } from 'expo';
import { touchTarget } from '../../../../ui/touch';
import * as MediaLibrary from 'expo-media-library';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Image, PixelRatio, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../../../../theme';
import { Icon, type IconName } from '../../../../ui/icons';
import { Pressable } from '../../../../ui/Pressable';
import { Text } from '../../../../ui/Text';
import { DownloadCancelled, useFileStatus } from '../../media/download';
import { mediaKind, tileMax, tileSize } from '../../media/kind';
import { cacheFile, useMediaMeta } from '../../media/meta';
import { streamUrl, imageUrl } from '../../media/urls';
import { viewerSession, type ViewerSession } from '../../media/viewer';
import type { Attachment } from '../../types';
import { useCookie } from '../useCookie';
import { fetchAttachment, fileKey, fileName, shareFile } from '../useOpenAttachment';
import { ProgressRing } from './ProgressRing';
import { Zoomable } from './Zoomable';

const fullWidth = 2048;

function mute(player: VideoPlayer, muted: boolean) {
  player.muted = muted;
}
const noticeMs = 2400;

function Bar({ icon, label, onPress, testID, busy }: { icon: IconName; label: string; onPress: () => void; testID: string; busy?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ busy }} hitSlop={8} onPress={onPress} testID={testID} style={styles.barButton}>
      {busy ? <ActivityIndicator color={colors.onStage} /> : <Icon name={icon} color={colors.onStage} />}
    </Pressable>
  );
}

function PhotoPage({ item, accountId, origin, width, height, onZoomChange, onTap }: { item: Attachment; accountId: string; origin: string; width: number; height: number; onZoomChange: (zoomed: boolean) => void; onTap: () => void }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const cookie = useCookie();
  const meta = useMediaMeta(accountId, item);
  const [state, setState] = useState<'loading' | 'shown' | 'failed'>('loading');
  const headers = cookie ? { headers: cookie } : {};
  const small = imageUrl(origin, item, tileSize(meta, tileMax.width).width * PixelRatio.get());
  return (
    <Zoomable width={width} height={height} onZoomChange={onZoomChange} onSingleTap={onTap} testID="viewer-photo">
      <Image source={{ uri: small, ...headers }} style={{ width, height }} resizeMode="contain" />
      <Image
        source={{ uri: imageUrl(origin, item, fullWidth), ...headers }}
        style={[StyleSheet.absoluteFill, { width, height }]}
        resizeMode="contain"
        onLoad={() => setState('shown')}
        onError={() => setState('failed')}
      />
      {state === 'loading' ? <ActivityIndicator style={StyleSheet.absoluteFill} color={colors.onStage} /> : null}
      {state === 'failed' ? (
        <Text variant="callout" style={[styles.pageNotice, { color: colors.onStage, backgroundColor: colors.stageScrim }]}>
          {t('media.imageFailed')}
        </Text>
      ) : null}
    </Zoomable>
  );
}

function VideoPreview({ item, width, height, accountId }: { item: Attachment; width: number; height: number; accountId: string }) {
  const { colors } = useTheme();
  const meta = useMediaMeta(accountId, item);
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      {meta.preview ? <Image source={{ uri: cacheFile(meta.preview).uri }} style={{ width, height }} resizeMode="contain" /> : null}
      <View style={[styles.play, { backgroundColor: colors.stageScrim }]}>
        <Icon name="play" variant="fill" color={colors.onStage} />
      </View>
    </View>
  );
}

function VideoPage({ item, session, width, height, muted }: { item: Attachment; session: ViewerSession; width: number; height: number; muted: boolean }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const cookie = useCookie();
  const player = useVideoPlayer({ uri: streamUrl(session.origin, item), ...(cookie ? { headers: cookie } : {}) }, (created) => {
    created.muted = muted;
    created.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const download = useFileStatus(fileKey(session.accountId, item), fileName(item));
  const [local, setLocal] = useState(false);
  useEffect(() => mute(player, muted), [muted, player]);
  const downloadAndPlay = () => {
    void fetchAttachment(item)
      .then(async (file) => {
        if (!file) return;
        await player.replaceAsync({ uri: file.uri });
        setLocal(true);
        player.play();
      })
      .catch(() => undefined);
  };
  return (
    <View style={{ width, height }}>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} allowsPictureInPicture={false} testID="video-player" />
      <View
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={isPlaying ? t('media.playing') : t('media.paused')}
        testID="video-state"
        pointerEvents="none"
        style={styles.state}
      />
      {status === 'error' && !local ? (
        <View style={[styles.failure, { backgroundColor: colors.stageScrim }]} testID="video-failed">
          <Text variant="callout" style={[styles.centerText, { color: colors.onStage }]}>
            {t('media.playFailed')}
          </Text>
          {download.state === 'downloading' ? (
            <ProgressRing received={download.received} total={download.total} color={colors.onStage} track={colors.stageScrim} />
          ) : (
            <Pressable accessibilityRole="button" onPress={downloadAndPlay} testID="video-download" style={[styles.pill, { backgroundColor: colors.onStage }]}>
              <Icon name="download" size={20} color={colors.stage} />
              <Text variant="callout" style={{ color: colors.stage }}>
                {t('media.downloadAndPlay')}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </View>
  );
}

export function MediaViewer() {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [session] = useState(viewerSession);
  const [index, setIndex] = useState(session?.index ?? 0);
  const [chrome, setChrome] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const list = useRef<FlatList<Attachment>>(null);
  useEffect(() => {
    if (!session) router.back();
  }, [session]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), noticeMs);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    list.current?.scrollToOffset({ offset: index * width, animated: false });
  }, [width, index]);
  const toggleChrome = useCallback(() => setChrome((shown) => !shown), []);
  if (!session) return null;
  const current = session.items[index] ?? session.items[0];
  const isVideo = mediaKind(current) === 'video';
  const share = () => {
    setBusy('share');
    void fetchAttachment(current)
      .then((file) => (file ? shareFile(current, file.uri, t) : undefined))
      .catch((error) => {
        if (!(error instanceof DownloadCancelled)) setNotice(t('errors.network'));
      })
      .finally(() => setBusy(null));
  };
  const save = () => {
    setBusy('save');
    void (async () => {
      try {
        const permission = await MediaLibrary.requestPermissionsAsync(true, [isVideo ? 'video' : 'photo']);
        if (!permission.granted) {
          setNotice(t('media.saveDenied'));
          return;
        }
        const file = await fetchAttachment(current);
        if (!file) return;
        await MediaLibrary.Asset.create(file.uri);
        setNotice(t('media.saved'));
      } catch {
        setNotice(t('media.saveFailed'));
      } finally {
        setBusy(null);
      }
    })();
  };
  return (
    <View style={[styles.flex, { backgroundColor: colors.stage }]} testID="media-viewer" accessibilityLabel={t('media.viewer')}>
      <StatusBar hidden={!chrome} style="light" />
      <FlatList
        ref={list}
        data={session.items}
        horizontal
        pagingEnabled
        scrollEnabled={!zoomed}
        initialScrollIndex={session.index}
        getItemLayout={(_, at) => ({ length: width, offset: width * at, index: at })}
        keyExtractor={(item) => String(item.id)}
        showsHorizontalScrollIndicator={false}
        windowSize={3}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        extraData={`${index}|${muted}|${width}`}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          if (next !== index) {
            setIndex(next);
            setZoomed(false);
          }
        }}
        renderItem={({ item, index: at }) =>
          mediaKind(item) === 'video' ? (
            at === index ? (
              <VideoPage item={item} session={session} width={width} height={height} muted={muted} />
            ) : (
              <VideoPreview item={item} width={width} height={height} accountId={session.accountId} />
            )
          ) : (
            <PhotoPage item={item} accountId={session.accountId} origin={session.origin} width={width} height={height} onZoomChange={setZoomed} onTap={toggleChrome} />
          )
        }
      />
      {chrome ? (
        <View style={[styles.top, { paddingTop: insets.top + space.xs, backgroundColor: colors.stageScrim }]} pointerEvents="box-none">
          <Bar icon="close" label={t('media.close')} onPress={() => router.back()} testID="viewer-close" />
          <View style={styles.title}>
            <Text variant="headline" numberOfLines={1} style={{ color: colors.onStage }}>
              {current.name}
            </Text>
            {session.items.length > 1 ? (
              <Text variant="footnote" style={{ color: colors.onStage }} testID="viewer-counter">
                {t('media.counter', { index: index + 1, count: session.items.length })}
              </Text>
            ) : null}
          </View>
          {isVideo ? (
            <Bar icon={muted ? 'speakerOff' : 'speaker'} label={muted ? t('media.unmute') : t('media.mute')} onPress={() => setMuted((value) => !value)} testID="viewer-mute" />
          ) : null}
          <Bar icon="share" label={t('media.share')} onPress={share} testID="viewer-share" busy={busy === 'share'} />
          <Bar icon="download" label={t('media.save')} onPress={save} testID="viewer-save" busy={busy === 'save'} />
        </View>
      ) : null}
      {notice ? (
        <View style={[styles.notice, { bottom: insets.bottom + space.xl, backgroundColor: colors.surface }]} accessibilityLiveRegion="polite" testID="viewer-notice">
          <Text variant="callout">{notice}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingBottom: space.sm },
  title: { flex: 1, minWidth: 0 },
  barButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  play: { position: 'absolute', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  pageNotice: { position: 'absolute', alignSelf: 'center', padding: space.md, borderRadius: radius.md },
  failure: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  centerText: { textAlign: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.pill },
  notice: { position: 'absolute', alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill },
  state: { position: 'absolute', left: 0, bottom: 0, width: 1, height: 1 },
});
