import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, Linking, Platform, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import Animated from 'react-native-reanimated';
import { ScreenCapturePickerView } from '@livekit/react-native-webrtc';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layoutFor, pagesFor, presenterOf, stageFor, stageView, tileGap } from '../grid';
import { screenShareSupported, setBroadcastPicker } from '../screenShare';
import { useTheme, space } from '../../../theme';
import { Text } from '../../../ui/Text';
import { Icon } from '../../../ui/icons';
import { Avatar } from '../../chat/ui/Avatar';
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
  personVolume,
  setPersonVolume,
  toggleDeafen,
  toggleHand,
  toggleSpeaker,
  toggleVideoOnly,
  toggleBlur,
  useCallState,
  type CallPerson,
} from '../call';
import { conversationById, getChat } from '../../chat/chat';
import { InviteSheet, OutputSheet } from './CallSheets';
import { usePictureInPictureAllowed } from '../pipSetting';
import { useElapsed } from '../clock';
import { blurSupported } from '../blur';
import { controlsFor, type CallAction } from '../controls';
import { CallPill, MoreSheet, RoundButton, type ControlState } from './CallControls';
import { CallTile } from './CallTile';
import { FloatingTile } from './FloatingTile';
import { ScreenStage, type PipTarget } from './ScreenStage';
import { useAutoHide } from './useAutoHide';
import { confirm } from '../../../ui/dialog';

const pillSize = 68;
const scrimSize = 72;
const edge = space.lg;
const wideMin = 840;

export function CallScreen() {
  const { t } = useTranslation('call');
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const call = useCallState();
  const layout = layoutFor(width, height);
  const vertical = layout.controls === 'rail';
  usePictureInPictureAllowed();
  const spec = pictureInPictureSpec(call);
  const pipTarget: PipTarget = spec.enabled && call.focus ? { ...call.focus, size: { width: spec.width, height: spec.height } } : null;
  const pipFor = (person: CallPerson) => (pipTarget?.source === 'camera' && pipTarget.sid === person.sid ? pipTarget.size : null);
  const compact = call.pictureInPicture || layout.pip;
  const stageRef = useRef<ComponentRef<typeof View>>(null);
  const shared = presenterOf(call.people);
  const presenter = compact && shared?.local ? null : shared;
  const self = call.people.find((person) => person.local) ?? null;
  const remote = call.people.filter((person) => !person.local);
  const remoteVideo = remote.some((person) => person.cameraOn || person.screenOn);
  const [sheet, setSheet] = useState<'more' | 'people' | null>(null);
  const [panel, setPanel] = useState<'invite' | 'output' | null>(null);
  const [spotlight, setSpotlight] = useState(false);
  const [swapped, setSwapped] = useState(false);
  const spotted =
    spotlight && call.people.length > 2
      ? (remote.find((person) => person.sid === call.focus?.sid) ?? remote.find((person) => call.speaking.includes(person.sid)) ?? remote[0] ?? null)
      : null;
  const view = stageView({ people: call.people, presenter, spotted, swapped });
  const onStage = view.onStage;
  const canInvite = (conversationById(getChat(), call.channelId)?.type ?? 'chat') !== 'chat';
  const pinned = call.phase !== 'active' || !remoteVideo || call.screenSharing || sheet !== null;
  const hide = useAutoHide(pinned, `${call.muted}|${call.cameraOn}|${call.recording}|${call.speaker}`);
  const elapsed = useElapsed(call.startedAt, call.phase === 'active');

  const share = call.phase === 'active' && screenShareSupported();
  const controls = controlsFor({
    phase: call.phase,
    cameraOn: call.cameraOn,
    sharing: call.screenSharing,
    share,
    record: call.phase === 'active',
    pip: pictureInPictureSupported(),
    wide: width >= wideMin,
    invite: canInvite,
    crowd: call.people.length > 2,
    blur: blurSupported(),
  });
  const state: ControlState = {
    muted: call.muted || call.deaf,
    cameraOn: call.cameraOn,
    cameraBlocked: call.cameraBlocked,
    speaker: call.speaker,
    sharing: call.screenSharing,
    recording: call.phase === 'active' ? { on: call.recording, busy: call.recordingBusy } : null,
    deaf: call.deaf,
    hand: call.hand,
    spotlight,
    videoOnly: call.videoOnly,
    blur: call.blur,
  };

  const [measured, setMeasured] = useState<{ width: number; height: number } | null>(null);
  const onStageLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout;
    setMeasured((current) => (current && current.width === next.width && current.height === next.height ? current : { width: next.width, height: next.height }));
  };

  const grid = useMemo(() => {
    const withVideo = call.people.filter((person) => person.cameraOn || person.screenOn);
    const shown = call.videoOnly && withVideo.length ? withVideo : call.people;
    const ids = shown.map((person) => person.sid);
    const stage = stageFor(shown.length, measured?.width ?? width, (measured?.height ?? height) - tileGap);
    return { stage, ids: pagesFor(ids, call.speaking, stage.perPage)[0] ?? [] };
  }, [call.people, call.speaking, call.videoOnly, width, height, measured]);

  const live = useRef(call.phase !== 'idle');
  useEffect(() => {
    if (call.phase !== 'idle') {
      live.current = true;
      return;
    }
    if (live.current) router.back();
  }, [call.phase, router]);

  const announced = useRef({ muted: call.muted, cameraOn: call.cameraOn });
  useEffect(() => {
    const before = announced.current;
    announced.current = { muted: call.muted, cameraOn: call.cameraOn };
    if (!hide.screenReader) return;
    if (before.muted !== call.muted) AccessibilityInfo.announceForAccessibility(call.muted ? t('microphoneOff') : t('microphoneOn'));
    if (before.cameraOn !== call.cameraOn) AccessibilityInfo.announceForAccessibility(call.cameraOn ? t('cameraLive') : t('cameraOff'));
  }, [call.muted, call.cameraOn, hide.screenReader, t]);

  const title = call.channelName || call.callerName;
  const subtitle =
    call.phase === 'outgoing' || (call.phase === 'active' && call.waiting)
      ? t(call.waiting ?? 'calling')
      : call.phase === 'connecting'
        ? t('connecting')
        : call.phase === 'reconnecting'
          ? t('reconnecting')
          : call.phase === 'ended'
            ? t(endedKey(call.endedReason))
            : (elapsed ?? '');

  const onAction = (action: CallAction) => {
    setSheet(action === 'more' ? 'more' : action === 'people' ? 'people' : null);
    if (action === 'mute') void toggleMute();
    if (action === 'camera') {
      const blocked = call.cameraBlocked;
      void toggleCamera().then((result) => {
        if (result === 'blocked' && blocked) void askForCamera(t('cameraBlocked.title'), t('cameraBlocked.body'), t('cameraBlocked.cancel'), t('cameraBlocked.settings'));
      });
    }
    if (action === 'flip') void flipCamera();
    if (action === 'speaker') void toggleSpeaker();
    if (action === 'share') void toggleScreenShare();
    if (action === 'record') void toggleRecording();
    if (action === 'pip') void enterPictureInPicture();
    if (action === 'deafen') void toggleDeafen();
    if (action === 'hand') toggleHand();
    if (action === 'videoOnly') toggleVideoOnly();
    if (action === 'blur') toggleBlur();
    if (action === 'spotlight') setSpotlight((current) => !current);
    if (action === 'invite' || action === 'output') setPanel(action);
    if (action === 'close') router.back();
    if (action === 'hangup') {
      void hangUp('left');
      router.back();
    }
  };

  const ink = onStage ? colors.onStage : colors.ink;
  const soft = onStage ? colors.onStage : colors.inkSoft;

  if (compact) {
    const focused = call.people.find((person) => person.sid === call.focus?.sid) ?? remote[0] ?? self;
    return (
      <View style={[styles.fill, { backgroundColor: colors.stage }]} testID="call-pip">
        {presenter ? (
          <ScreenStage presenter={presenter} people={[]} side={false} pip={pipTarget} />
        ) : focused ? (
          <CallTile person={focused} width={width} height={height} corner={0} bare pip={pipFor(focused)} />
        ) : null}
      </View>
    );
  }

  const { big, small } = view;
  const scrimTop = insets.top + scrimSize;
  const pillBottom = insets.bottom + edge;
  const shownPill = hide.shown ? pillSize + space.md : 0;
  const framed = { paddingTop: scrimTop, paddingBottom: vertical ? insets.bottom + space.sm : pillBottom + pillSize + space.sm, paddingLeft: insets.left + space.sm, paddingRight: vertical ? insets.right + pillSize + edge + space.sm : insets.right + space.sm };

  let stage;
  if (presenter) {
    stage = (
      <View style={[styles.fill, framed]}>
        <ScreenStage presenter={presenter} people={call.people} side={vertical} pip={pipTarget} />
      </View>
    );
  } else if (big) {
    stage = <CallTile person={big} width={width} height={height} corner={0} bare pip={pipFor(big)} />;
  } else if (view.kind === 'grid') {
    stage = (
      <View style={[styles.fill, framed]}>
        <View style={styles.grid} onLayout={onStageLayout} testID="call-grid">
          {grid.ids.map((sid, index) => {
            const person = call.people.find((item) => item.sid === sid);
            if (!person) return null;
            const columns = grid.stage.columns;
            return (
              <View key={sid} style={{ paddingRight: index % columns === columns - 1 ? 0 : tileGap, paddingBottom: tileGap }}>
                <CallTile person={person} width={grid.stage.tileWidth} height={grid.stage.tileHeight} corner={call.people.length < 3 ? 18 : 0} pip={pipFor(person)} />
              </View>
            );
          })}
        </View>
      </View>
    );
  } else {
    const face = view.face;
    stage = (
      <View style={[styles.fill, styles.center]} testID="call-stage-avatar">
        <Avatar name={face?.name ?? title} seed={face?.partnerId ?? call.callerPartnerId ?? call.channelId} partnerId={face ? face.partnerId : call.callerPartnerId} size={112} />
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: onStage ? colors.stage : colors.canvas }]} testID="call-screen">
      {onStage ? <StatusBar style="light" /> : null}
      <Pressable accessible={false} onPress={hide.toggle} style={styles.fill} testID="call-stage">
        <View
          ref={stageRef}
          collapsable={false}
          style={styles.fill}
          onLayout={() => {
            if (Platform.OS === 'android') stageRef.current?.measureInWindow(setPictureInPictureHint);
          }}>
          {stage}
        </View>
      </Pressable>

      {small ? (
        <FloatingTile
          person={small}
          area={{ width, height }}
          top={insets.top + (hide.shown ? scrimSize : 0) + space.sm}
          bottom={pillBottom + (vertical ? 0 : shownPill)}
          side={(vertical ? insets.right + pillSize + edge : insets.right) + edge}
          pip={pipFor(small)}
          onSwap={() => setSwapped((current) => !current)}
        />
      ) : null}

      <Animated.View
        pointerEvents={hide.shown ? 'box-none' : 'none'}
        importantForAccessibility={hide.shown ? 'auto' : 'no-hide-descendants'}
        accessibilityElementsHidden={!hide.shown}
        style={[styles.scrim, { paddingTop: insets.top + space.sm, paddingLeft: insets.left + space.sm, paddingRight: insets.right + edge, backgroundColor: onStage ? colors.stageScrim : 'transparent' }, hide.top]}>
        <RoundButton icon="chevronDown" label={t('minimize')} onStage={onStage} size={44} onPress={() => router.back()} testID="call-minimize" />
        <View style={styles.heading}>
          <Text variant="headline" numberOfLines={1} style={{ color: ink }} testID="call-title">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="footnote" numberOfLines={2} style={{ color: soft }} accessibilityLiveRegion="polite" testID="call-status">
              {subtitle}
            </Text>
          ) : null}
          {call.cameraBlocked && !call.cameraOn ? (
            <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} testID="call-camera-blocked">
              <Text variant="footnote" tone="warnInk" accessibilityLiveRegion="polite">
                {t('cameraBlocked.notice')}
              </Text>
            </Pressable>
          ) : null}
          {call.recordingError ? (
            <Text variant="footnote" tone="warnInk" accessibilityLiveRegion="polite" testID="call-recording-error">
              {t(recordingErrorKey(call.recordingError))}
            </Text>
          ) : null}
          <FullScreenNotice />
        </View>
      </Animated.View>

      {call.recording ? (
        <View
          style={[styles.recording, { top: insets.top + (hide.shown ? scrimSize : 0) + space.sm, left: insets.left + edge, backgroundColor: colors.stageScrim }]}
          accessible
          accessibilityLabel={call.recordingBy ? t('recordingBy', { name: call.recordingBy }) : t('recording')}
          accessibilityLiveRegion="polite"
          testID="call-recording">
          <Icon name="record" size={16} color={colors.danger} variant="fill" />
          <Text variant="label" style={{ color: colors.onStage }}>
            {t('recording')}
          </Text>
        </View>
      ) : null}

      <View pointerEvents="box-none" style={vertical ? [styles.railDock, { right: insets.right + edge }] : [styles.barDock, { bottom: pillBottom, left: insets.left, right: insets.right }]}>
        <CallPill actions={controls.pill} state={state} onStage={onStage} vertical={vertical} shown={hide.shown} motion={hide.bottom} onAction={onAction} onTouch={hide.poke} />
      </View>

      <MoreSheet
        view={sheet}
        actions={controls.more}
        state={state}
        people={call.people}
        onAction={onAction}
        onClose={() => setSheet(null)}
        onVolume={(person, volume) => setPersonVolume(person.sid, volume)}
        volumeOf={(person) => personVolume(person.partnerId)}
      />
      {panel === 'invite' ? <InviteSheet channelId={call.channelId} onClose={() => setPanel(null)} /> : null}
      {panel === 'output' ? <OutputSheet current={call.output} onClose={() => setPanel(null)} /> : null}

      {Platform.OS === 'ios' && share ? (
        <View style={styles.picker} pointerEvents="none">
          <ScreenCapturePickerView ref={setBroadcastPicker} />
        </View>
      ) : null}
    </View>
  );
}

async function askForCamera(title: string, body: string, cancel: string, settings: string) {
  if (await confirm({ title, body, cancel, confirm: settings, icon: 'videoOff', testID: 'call-camera-settings-dialog' })) await Linking.openSettings();
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
  'unanswered',
  'disconnected',
  'removed',
  'microphone',
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
  center: { alignItems: 'center', justifyContent: 'center' },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', overflow: 'hidden' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', gap: space.xs, paddingBottom: space.sm },
  heading: { flex: 1, gap: 2, paddingTop: 2 },
  recording: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: 999 },
  barDock: { position: 'absolute', alignItems: 'center' },
  railDock: { position: 'absolute', top: 0, bottom: 0, justifyContent: 'center' },
  picker: { width: 1, height: 1, opacity: 0, position: 'absolute' },
});
