import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { ScreenCapturePickerView } from '@livekit/react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layoutFor, pagesFor, presenterOf, stageFor, tileGap } from '../grid';
import { screenShareSupported, setBroadcastPicker } from '../screenShare';
import { useTheme, space } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/icons';
import {
  enterPictureInPicture,
  flipCamera,
  fullScreenIntentAllowed,
  hangUp,
  openFullScreenIntentSettings,
  pictureInPictureSpec,
  pictureInPictureSupported,
  setPictureInPictureHint,
  toggleCamera,
  toggleMute,
  toggleRecording,
  toggleScreenShare,
  toggleSpeaker,
  useCallState,
} from '../call';
import { usePictureInPictureAllowed } from '../pipSetting';
import { CallControls, type CallAction } from './CallControls';
import { CallTile } from './CallTile';
import { ScreenStage } from './ScreenStage';

export function CallScreen() {
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const call = useCallState();
  const layout = layoutFor(width, height);
  const pip = pictureInPictureSupported();
  usePictureInPictureAllowed();
  const spec = pictureInPictureSpec(call);
  const pipTarget = spec.enabled && call.focus ? { ...call.focus, size: { width: spec.width, height: spec.height } } : null;
  const compact = call.pictureInPicture || layout.pip;
  const stageRef = useRef<ComponentRef<typeof View>>(null);
  const share = call.phase === 'active' && screenShareSupported();
  const shared = presenterOf(call.people);
  const presenter = compact && shared?.local ? null : shared;
  const recording = call.phase === 'active' ? { on: call.recording, busy: call.recordingBusy } : null;

  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const onStageLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    setMeasured((current) => (current && current.width === next.width && current.height === next.height ? current : { width: next.width, height: next.height }));
    if (Platform.OS === 'android') stageRef.current?.measureInWindow(setPictureInPictureHint);
  };

  const focusSid = compact ? call.focus?.sid ?? null : null;
  const visible = useMemo(() => {
    const ids = focusSid ? [focusSid] : call.people.map((person) => person.sid);
    const stageWidth = measured?.width ?? Math.max(240, width - (layout.controls === 'rail' ? 120 : 2 * space.md));
    const stageHeight = measured ? measured.height - (focusSid ? 0 : tileGap) : Math.max(180, height - (layout.people === 'side' ? 260 : 220));
    const stage = stageFor(ids.length, stageWidth, stageHeight);
    const pages = pagesFor(ids, call.speaking, stage.perPage);
    return { stage, ids: pages[0] ?? [] };
  }, [focusSid, call.people, call.speaking, width, height, layout.controls, layout.people, measured]);

  const live = useRef(call.phase !== 'idle');
  useEffect(() => {
    if (call.phase !== 'idle') {
      live.current = true;
      return;
    }
    if (live.current) router.back();
  }, [call.phase, router]);

  const title = call.channelName || call.callerName;
  const subtitle =
    call.phase === 'outgoing'
      ? t('calling')
      : call.phase === 'connecting'
        ? t('connecting')
        : call.phase === 'reconnecting'
          ? t('reconnecting')
          : call.phase === 'ended'
            ? t(endedKey(call.endedReason))
            : t('participants', { count: call.people.length });

  const onAction = (action: CallAction) => {
    if (action === 'mute') void toggleMute();
    if (action === 'camera') void toggleCamera();
    if (action === 'flip') void flipCamera();
    if (action === 'speaker') void toggleSpeaker();
    if (action === 'share') void toggleScreenShare();
    if (action === 'record') void toggleRecording();
    if (action === 'pip') void enterPictureInPicture();
    if (action === 'hangup') {
      void hangUp('left');
      router.back();
    }
  };

  const stage = visible.stage;
  const people = visible.ids
    .map((sid) => call.people.find((person) => person.sid === sid))
    .filter((person): person is NonNullable<typeof person> => Boolean(person));

  return (
    <View
      style={[styles.fill, compact ? styles.compact : { backgroundColor: colors.canvas, paddingTop: insets.top, paddingBottom: insets.bottom }]}
      testID={compact ? 'call-pip' : 'call-screen'}
    >
      {compact ? null : <View style={[styles.top, layout.controls === 'rail' ? styles.topRail : null]}>
        <View style={styles.heading}>
          <Text variant="title" numberOfLines={1} testID="call-title">
            {title}
          </Text>
          <Text variant="footnote" tone="inkSoft" numberOfLines={2} testID="call-status">
            {subtitle}
          </Text>
          {call.recording ? (
            <View style={styles.recording} accessibilityLiveRegion="polite" testID="call-recording">
              <Icon name="record" size={16} color={colors.danger} />
              <Text variant="footnote" style={{ color: colors.danger }}>
                {call.recordingBy ? t('recordingBy', { name: call.recordingBy }) : t('recording')}
              </Text>
            </View>
          ) : null}
          {call.recordingError ? (
            <Text variant="footnote" tone="warnInk" accessibilityLiveRegion="polite" testID="call-recording-error">
              {t(recordingErrorKey(call.recordingError))}
            </Text>
          ) : null}
          <FullScreenNotice />
        </View>
        {layout.controls === 'rail' ? null : <CallControls vertical={false} video={call.video} muted={call.muted} cameraOn={call.cameraOn} speaker={call.speaker} pip={pip} share={share} sharing={call.screenSharing} recording={recording} onAction={onAction} />}
      </View>}

      <View style={[styles.body, compact ? styles.bodyCompact : layout.controls === 'rail' ? styles.bodyRail : null]}>
        <View ref={stageRef} style={styles.stage} onLayout={onStageLayout} testID="call-stage">
          {presenter ? (
            <ScreenStage presenter={presenter} people={compact ? [] : call.people} side={layout.controls === 'rail'} onStop={() => void toggleScreenShare()} pip={pipTarget} />
          ) : people.length === 0 ? (
            <View style={styles.center}>
              <Text variant="body" tone="inkSoft" numberOfLines={2}>
                {subtitle}
              </Text>
            </View>
          ) : (
            people.map((person, index) => {
              const columns = stage.columns;
              return (
                <View key={person.sid} style={compact ? null : { paddingRight: index % columns === columns - 1 ? 0 : tileGap, paddingBottom: tileGap }}>
                  <CallTile
                    person={person}
                    width={stage.tileWidth}
                    height={stage.tileHeight}
                    rounded={!compact && call.people.length < 3}
                    pip={pipTarget?.source === 'camera' && pipTarget.sid === person.sid ? pipTarget.size : null}
                  />
                </View>
              );
            })
          )}
        </View>
        {layout.controls === 'rail' && !compact ? (
          <View style={styles.rail}>
            <CallControls vertical video={call.video} muted={call.muted} cameraOn={call.cameraOn} speaker={call.speaker} pip={pip} share={share} sharing={call.screenSharing} recording={recording} onAction={onAction} />
          </View>
        ) : null}
      </View>

      {call.people.length > 3 && layout.people === 'side' && !compact ? (
        <ScrollView style={styles.side} contentContainerStyle={styles.sideInner} testID="call-people">
          {call.people.map((person) => (
            <View key={person.sid} style={styles.person}>
              <Icon name={person.micOn ? 'mic' : 'micOff'} size={16} color={person.speaking ? colors.primary : colors.inkFaint} />
              <Text variant="callout" numberOfLines={1} style={styles.flex}>
                {person.local ? t('you') : person.name}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      {Platform.OS === 'ios' && share ? <View style={styles.picker} pointerEvents="none">
          <ScreenCapturePickerView ref={setBroadcastPicker} />
        </View> : null}

      {call.phase === 'ended' && !compact ? (
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.ended, { backgroundColor: colors.surface }]} testID="call-close">
          <Text variant="callout" tone="inkSoft">
            {t('close')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FullScreenNotice() {
  const { t } = useTranslation('call');
  const [needed, setNeeded] = useState(false);
  useEffect(() => {
    void fullScreenIntentAllowed().then((allowed) => setNeeded(!allowed));
  }, []);
  if (!needed) return null;
  return (
    <Pressable accessibilityRole="button" onPress={() => void openFullScreenIntentSettings()} testID="call-fullscreen-notice">
      <Text variant="footnote" tone="warnInk">
        {t('fullScreen.title')} — {t('fullScreen.body')}. {t('fullScreen.action')}
      </Text>
    </Pressable>
  );
}

const endedReasons = [
  'left',
  'declined',
  'disconnected',
  'removed',
  'microphone',
  'camera',
  'signedOut',
  'call_unavailable',
  'temporarily_unavailable',
  'forbidden',
  'not_found',
  'network',
  'call_failed',
] as const;

type EndedReason = (typeof endedReasons)[number];

const recordingErrors = ['not_in_call', 'not_recording', 'recording_busy', 'call_unavailable', 'recording_unavailable', 'network'] as const;

function recordingErrorKey(code: string): `recordingErrors.${(typeof recordingErrors)[number] | 'other'}` {
  return `recordingErrors.${recordingErrors.find((item) => item === code) ?? 'other'}`;
}

function endedKey(reason: string | null): `ended.${EndedReason}` {
  const found = endedReasons.find((item) => item === reason) ?? 'left';
  return `ended.${found}`;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  topRail: { paddingBottom: space.xs },
  heading: { gap: 2 },
  recording: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  picker: { width: 1, height: 1, opacity: 0, position: 'absolute' },
  body: { flex: 1, paddingHorizontal: space.md },
  bodyRail: { flexDirection: 'row' },
  bodyCompact: { paddingHorizontal: 0 },
  compact: { backgroundColor: '#000000' },
  stage: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', overflow: 'hidden' },
  rail: { justifyContent: 'center', paddingLeft: space.sm },
  side: { maxHeight: 132, borderTopWidth: StyleSheet.hairlineWidth },
  sideInner: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.xs },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ended: { margin: space.lg, padding: space.md, borderRadius: 16, alignItems: 'center' },
});
