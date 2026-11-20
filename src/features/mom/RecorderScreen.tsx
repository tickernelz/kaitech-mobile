import { useRouter } from 'expo-router';
import type { TFunction } from 'i18next';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWindowClass } from '../../layout/windowClass';
import { radius, space, type as typography, useTheme } from '../../theme';
import { Text } from '../../ui/Text';
import { Chip, IconButton } from '../discovery/ui';
import { MomIcon, useMomFormat, Waveform, type MomIconName } from './parts';
import {
  bitRate,
  clock,
  describeMarker,
  discardRecording,
  mark,
  pause,
  resume,
  stop,
  useRecorderClock,
  useRecording,
  type Recording,
} from './recorder';

function confirmStop(t: TFunction) {
  Alert.alert(t('mom.recorder.stopTitle'), t('mom.recorder.stopBody'), [
    { text: t('mom.recorder.cancel'), style: 'cancel' },
    { text: t('mom.recorder.stop'), onPress: () => void stop() },
  ]);
}

function confirmDiscard(t: TFunction) {
  Alert.alert(t('mom.recorder.discardTitle'), t('mom.recorder.discardBody'), [
    { text: t('mom.recorder.cancel'), style: 'cancel' },
    { text: t('mom.recorder.discard'), style: 'destructive', onPress: () => void discardRecording() },
  ]);
}

function RoundButton({
  icon,
  label,
  onPress,
  big = false,
  danger = false,
  disabled,
  testID,
}: {
  icon: MomIconName;
  label: string;
  onPress: () => void;
  big?: boolean;
  danger?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const size = big ? 80 : 60;
  return (
    <View style={styles.roundWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled}
        onPress={onPress}
        testID={testID}
        style={({ pressed }) => [
          styles.round,
          {
            width: size,
            height: size,
            backgroundColor: danger ? colors.danger : colors.surface,
            borderColor: danger ? colors.dangerBand : colors.line,
            borderWidth: danger ? 6 : StyleSheet.hairlineWidth,
            opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          },
        ]}>
        <MomIcon name={icon} size={big ? 30 : 24} color={danger ? '#FFFFFF' : colors.ink} />
      </Pressable>
      <Text variant="footnote" style={styles.roundLabel} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
    </View>
  );
}

function Controls({ recording, compact = false }: { recording: Recording; compact?: boolean }) {
  const { t } = useTranslation();
  const saving = recording.phase === 'saving';
  const paused = recording.phase === 'paused';
  if (compact) {
    return (
      <View style={styles.barControls}>
        <SmallRound icon="flag" label={t('mom.recorder.mark')} onPress={() => void mark()} disabled={saving} testID="bar-mark" />
        <SmallRound icon={paused ? 'record' : 'pause'} label={paused ? t('mom.recorder.resume') : t('mom.recorder.pause')} onPress={paused ? resume : pause} disabled={saving} />
        <SmallRound icon="stop" label={t('mom.recorder.stop')} onPress={() => confirmStop(t)} disabled={saving} danger testID="bar-stop" />
      </View>
    );
  }
  return (
    <View style={styles.controls}>
      <RoundButton icon="flag" label={t('mom.recorder.mark')} onPress={() => void mark()} disabled={saving} testID="recorder-mark" />
      <RoundButton
        icon={paused ? 'record' : 'pause'}
        label={paused ? t('mom.recorder.resume') : t('mom.recorder.pause')}
        onPress={paused ? resume : pause}
        disabled={saving}
        testID={paused ? 'recorder-resume' : 'recorder-pause'}
      />
      <RoundButton icon="stop" label={t('mom.recorder.stop')} onPress={() => confirmStop(t)} disabled={saving} big danger testID="recorder-stop" />
    </View>
  );
}

function SmallRound({
  icon,
  label,
  onPress,
  disabled,
  danger,
  testID,
}: {
  icon: MomIconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.smallRound,
        { backgroundColor: danger ? colors.danger : pressed ? colors.surface2 : colors.surface, borderColor: colors.line, opacity: disabled ? 0.4 : 1 },
      ]}>
      <MomIcon name={icon} size={22} color={danger ? '#FFFFFF' : colors.ink} />
    </Pressable>
  );
}

function StatusChip({ recording }: { recording: Recording }) {
  const { t } = useTranslation();
  if (recording.phase === 'saving') return <Chip tone="neutral" label={t('mom.recorder.saving')} />;
  if (recording.phase === 'paused') return <Chip tone="warn" label={t('mom.recorder.paused')} />;
  return <Chip tone="danger" label={`● ${t('mom.recorder.recording')}`} />;
}

function Markers({ recording }: { recording: Recording }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!recording.markers.length) return null;
  return (
    <View style={styles.markers}>
      <Text variant="label" tone="selectInk">
        {t('mom.recorder.markers', { count: recording.markers.length })}
      </Text>
      <View style={[styles.markerCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        {recording.markers.map((marker) => (
          <View key={marker.id} style={[styles.marker, { borderColor: colors.line }]}>
            <Text variant="footnote" tone="inkSoft" style={styles.mono}>
              {clock(marker.atMs)}
            </Text>
            <TextInput
              defaultValue={marker.text}
              placeholder={t('mom.recorder.markerPlaceholder')}
              placeholderTextColor={colors.inkFaint}
              accessibilityLabel={`${t('mom.recorder.markerPlaceholder')} ${clock(marker.atMs)}`}
              onChangeText={(text) => describeMarker(marker.id, text)}
              style={[typography.callout, styles.markerInput, { color: colors.ink }]}
              testID="marker-text"
              multiline
            />
          </View>
        ))}
      </View>
    </View>
  );
}

export function RecorderScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const format = useMomFormat();
  const recording = useRecording();
  const { landscape, height } = useWindowClass();
  const live = useRecorderClock(recording?.phase === 'recording');

  useEffect(() => {
    if (recording) return;
    if (router.canGoBack()) router.back();
    else router.replace('/mom');
  }, [recording, router]);

  if (!recording) return null;
  const durationMs = recording.phase === 'recording' ? live.durationMs : recording.durationMs;
  const side = landscape && height < 520;
  const meter = (
    <View style={styles.meter}>
      <StatusChip recording={recording} />
      <Text
        style={[styles.timer, { color: colors.ink }, side && styles.timerSide]}
        maxFontSizeMultiplier={1.3}
        accessibilityLabel={t('mom.recorder.elapsed', { time: clock(durationMs) })}
        testID="recorder-time">
        {clock(durationMs)}
      </Text>
      <Waveform levels={live.levels} color={colors.primary} height={side ? 32 : 44} />
      <View style={styles.chips}>
        <Chip label={t('mom.recorder.format')} />
        <Chip label={t('mom.recorder.size', { size: format.size(((durationMs / 1000) * bitRate) / 8) })} />
        <Chip label={t('mom.recorder.screenOff')} />
      </View>
      {recording.consentAt ? (
        <View style={[styles.consent, { backgroundColor: colors.okBand }]}>
          <MomIcon name="check" size={20} color={colors.okInk} />
          <Text variant="callout" tone="okInk" style={styles.fill}>
            {t('mom.recorder.consent', { time: format.time(recording.consentAt) })}
          </Text>
        </View>
      ) : null}
    </View>
  );
  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: colors.canvas }]} testID="mom-recorder">
      <View style={styles.header}>
        <IconButton icon="down" label={t('mom.recorder.minimize')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/mom'))} testID="recorder-minimize" />
        <View style={styles.titles}>
          <Text variant="headline" numberOfLines={1} accessibilityRole="header">
            {recording.title}
          </Text>
          <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
            {recording.programme.name}
          </Text>
        </View>
        <IconButton icon="close" label={t('mom.recorder.discard')} onPress={() => confirmDiscard(t)} testID="recorder-discard" />
      </View>
      <ScrollView contentContainerStyle={[styles.body, side && styles.bodySide]} keyboardShouldPersistTaps="handled">
        {side ? (
          <>
            <View style={styles.column}>{meter}</View>
            <View style={styles.column}>
              <Controls recording={recording} />
              <Markers recording={recording} />
            </View>
          </>
        ) : (
          <>
            {meter}
            <Controls recording={recording} />
            <Markers recording={recording} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export function RecorderBar({ recording }: { recording: Recording }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const live = useRecorderClock(recording.phase === 'recording', 18);
  const durationMs = recording.phase === 'recording' ? live.durationMs : recording.durationMs;
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.line }]} testID="recorder-bar">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('mom.openRecorder')}
        onPress={() => router.push('/mom/record')}
        style={styles.barMain}
        testID="recorder-bar-open">
        <View style={[styles.dot, { backgroundColor: recording.phase === 'paused' ? colors.edge : colors.danger }]} />
        <View style={styles.titles}>
          <Text variant="callout" numberOfLines={1} style={styles.strong}>
            {recording.title}
          </Text>
          <Text variant="footnote" tone="inkSoft" style={styles.mono}>
            {clock(durationMs)}
          </Text>
        </View>
        <Waveform levels={live.levels} bars={18} color={colors.primary} height={24} />
      </Pressable>
      <Controls recording={recording} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  strong: { fontWeight: '600' },
  mono: { fontVariant: ['tabular-nums'] },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: 56 },
  titles: { flex: 1, gap: 2 },
  body: { padding: space.xl, gap: space.xl, width: '100%', maxWidth: 720, alignSelf: 'center' },
  bodySide: { flexDirection: 'row', maxWidth: 1000, paddingVertical: space.md },
  column: { flex: 1, gap: space.lg },
  meter: { alignItems: 'center', gap: space.md },
  timer: { fontSize: 64, lineHeight: 76, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -1 },
  timerSide: { fontSize: 48, lineHeight: 58 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  consent: { flexDirection: 'row', alignItems: 'center', gap: space.sm, alignSelf: 'stretch', padding: space.md, borderRadius: radius.md },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-start', gap: space.xl, flexWrap: 'wrap' },
  roundWrap: { alignItems: 'center', gap: space.xs, minWidth: 72 },
  round: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  roundLabel: { textAlign: 'center' },
  markers: { gap: space.sm, alignSelf: 'stretch' },
  markerCard: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  marker: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  markerInput: { flex: 1, minHeight: 44, paddingVertical: space.sm },
  bar: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  barMain: { flex: 1, minWidth: 240, flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  barControls: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  smallRound: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
