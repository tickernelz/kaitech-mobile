import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLanguage } from '../../i18n';
import { intlLocale } from '../../i18n/language';
import { radius, selectionBar, space, useTheme, type Colors } from '../../theme';
import { Text } from '../../ui/Text';
import { Chip } from '../discovery/ui';
import type { MeetingRow } from './api';
import { clock, useRecorderClock, type Recording } from './recorder';
import { isPending, sentBytes, type Upload } from './upload';
import { discard, dismiss, retry } from './uploads';

const paths = {
  record: 'M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 2.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z',
  flag: 'M5 3h2v1h11.5l-2.4 4.5L18.5 13H7v8H5Zm2 3v5h8.2l-1.3-2.5L15.2 6Z',
  pause: 'M7 5h3.5v14H7Zm6.5 0H17v14h-3.5Z',
  play: 'M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5a.8.8 0 0 0-1.2.7Z',
  stop: 'M7 7h10v10H7Z',
  cloud: 'M12 4a6 6 0 0 1 5.8 4.6A4.5 4.5 0 0 1 17.5 18H13v-4.2l1.6 1.6 1.4-1.4L12 10l-4 4 1.4 1.4 1.6-1.6V18H6.5a4.5 4.5 0 0 1-.9-8.9A6 6 0 0 1 12 4Z',
  check: 'm9.5 16.2-4.3-4.3-1.4 1.4 5.7 5.7L21.3 7.2l-1.4-1.4Z',
  sign: 'M3 17.3V21h3.7L17.8 9.9l-3.7-3.7Zm17.7-10.2a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0L15 5.1l3.7 3.7Z',
  minutes: 'M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5ZM8 12v2h8v-2Zm0 4v2h6v-2Z',
  wave: 'M11 3h2v18h-2Zm-4 5h2v8H7Zm8 2h2v4h-2ZM3 10h2v4H3Zm16-2h2v8h-2Z',
  collapse: 'm4.6 8.6 7.4 7.4 7.4-7.4L18 7.2l-6 6-6-6Z',
} as const;

export type MomIconName = keyof typeof paths;

export function MomIcon({ name, color, size = 22 }: { name: MomIconName; color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessible={false}>
      <Path d={paths[name]} fill={color} />
    </Svg>
  );
}

export function useMomFormat() {
  const { language } = useLanguage();
  const locale = intlLocale(language);
  const size = useCallback(
    (bytes: number) => {
      const units = ['B', 'KB', 'MB', 'GB'];
      let value = bytes;
      let unit = 0;
      while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
      }
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit >= 2 ? 1 : 0 }).format(value)} ${units[unit]}`;
    },
    [locale],
  );
  const day = useCallback(
    (value: string | Date) => {
      if (value instanceof Date) return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(value);
      const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : null;
      return parsed ? new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(parsed) : value;
    },
    [locale],
  );
  const time = useCallback(
    (value: Date | number) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(value),
    [locale],
  );
  const percent = useCallback((share: number) => new Intl.NumberFormat(locale, { style: 'percent' }).format(share), [locale]);
  return { size, day, time, percent };
}

export function Waveform({ levels, bars = 36, color, height = 40 }: { levels: number[]; bars?: number; color: string; height?: number }) {
  const shown = Array.from({ length: bars }, (_, index) => levels[levels.length - bars + index] ?? 0.06);
  return (
    <View style={[styles.wave, { height }]} importantForAccessibility="no-hide-descendants" accessible={false}>
      {shown.map((level, index) => (
        <View key={index} style={[styles.bar, { height: Math.max(4, level * height), backgroundColor: color }]} />
      ))}
    </View>
  );
}

type ChipTone = 'neutral' | 'select' | 'ok' | 'warn' | 'danger' | 'info';

const finalTones: Record<string, ChipTone> = { reviewed: 'warn', final: 'ok', distributed: 'ok' };
const chipTones: Record<string, ChipTone> = { generated: 'info', generating: 'select', failed: 'danger', stale: 'warn', locked: 'ok' };

export function MeetingChip({ row }: { row: Pick<MeetingRow, 'chip' | 'chipLabel'> & { final?: { state: string; status: string } } }) {
  const { t } = useTranslation();
  const final = row.final && row.final.state !== 'draft' ? row.final : null;
  if (final) return <Chip tone={finalTones[final.state] ?? 'neutral'} label={t(`mom.stage.${final.state}` as never, { defaultValue: final.status }) as string} />;
  return <Chip tone={chipTones[row.chip] ?? 'neutral'} label={t(`mom.chip.${row.chip}` as never, { defaultValue: row.chipLabel }) as string} />;
}

export function Line({
  icon,
  title,
  detail,
  trailing,
  onPress,
  selected,
  testID,
}: {
  icon: MomIconName;
  title: string;
  detail?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      disabled={!onPress}
      onPress={onPress}
      testID={testID}
      android_ripple={{ color: colors.select }}
      style={({ pressed }) => [
        styles.line,
        (pressed || selected) && { backgroundColor: selected ? colors.select : colors.surface2 },
        selected && { borderLeftWidth: selectionBar, borderLeftColor: colors.primary, paddingLeft: space.lg - selectionBar },
      ]}>
      <View style={[styles.lineIcon, { backgroundColor: colors.surface2 }]}>
        <MomIcon name={icon} size={20} color={colors.selectInk} />
      </View>
      <View style={styles.lineText}>
        <Text variant="callout" style={styles.strong}>
          {title}
        </Text>
        {detail ? (
          <Text variant="footnote" tone="inkSoft">
            {detail}
          </Text>
        ) : null}
        {trailing}
      </View>
    </Pressable>
  );
}

function Progress({ share, color, track }: { share: number; color: string; track: string }) {
  const { t } = useTranslation();
  const now = Math.round(share * 100);
  return (
    <View
      style={[styles.track, { backgroundColor: track }]}
      accessibilityRole="progressbar"
      accessibilityLabel={t('mom.upload.progress')}
      accessibilityValue={{ min: 0, max: 100, now }}>
      <View style={[styles.fillBar, { backgroundColor: color, width: `${now}%` }]} />
    </View>
  );
}

function uploadTone(state: Upload['state'], colors: Colors): string {
  if (state === 'failed') return colors.danger;
  if (state === 'done') return colors.ok;
  if (state === 'waiting' || state === 'signedOut') return colors.edge;
  return colors.primary;
}

export function UploadCard({ upload }: { upload: Upload }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const format = useMomFormat();
  const share = upload.state === 'done' ? 1 : upload.size ? sentBytes(upload) / upload.size : 0;
  const reason = t(`mom.errors.${upload.error ?? 'unknown'}` as never, { defaultValue: t('mom.errors.unknown') }) as string;
  const line = {
    queued: t('mom.upload.queued', { size: format.size(upload.size) }),
    sending: t('mom.upload.sending', { size: format.size(upload.size), percent: format.percent(share) }),
    waiting: t('mom.upload.waiting', { percent: format.percent(share) }),
    signedOut: t('mom.upload.signedOut'),
    failed: t('mom.upload.failed', { reason }),
    done: t('mom.upload.done'),
  }[upload.state];
  const confirmDiscard = () =>
    Alert.alert(t('mom.upload.discardTitle'), t('mom.upload.discardBody'), [
      { text: t('mom.upload.cancel'), style: 'cancel' },
      { text: t('mom.upload.discard'), style: 'destructive', onPress: () => void discard(upload.key) },
    ]);
  return (
    <View style={[styles.upload, { backgroundColor: colors.surface, borderColor: colors.line }]} testID={`upload-${upload.state}`}>
      <View style={styles.uploadTop}>
        <MomIcon name={upload.state === 'done' ? 'check' : 'cloud'} color={uploadTone(upload.state, colors)} />
        <View style={styles.lineText}>
          <Text variant="callout" style={styles.strong} numberOfLines={2}>
            {upload.title}
          </Text>
          <Text variant="footnote" tone={upload.state === 'failed' ? 'dangerInk' : 'inkSoft'} testID="upload-line">
            {line}
          </Text>
        </View>
      </View>
      {upload.state !== 'failed' ? <Progress share={share} color={uploadTone(upload.state, colors)} track={colors.line} /> : null}
      <View style={styles.actions}>
        {upload.state === 'failed' || upload.state === 'waiting' ? (
          <SmallButton label={t('mom.upload.retry')} onPress={() => retry(upload.key)} testID="upload-retry" />
        ) : null}
        {upload.state === 'done' ? (
          <SmallButton label={t('mom.upload.dismiss')} onPress={() => dismiss(upload.key)} testID="upload-dismiss" />
        ) : null}
        {isPending(upload) || upload.state === 'failed' ? (
          upload.state === 'sending' ? null : <SmallButton label={t('mom.upload.discard')} onPress={confirmDiscard} tone="dangerInk" testID="upload-discard" />
        ) : null}
      </View>
    </View>
  );
}

export function SmallButton({
  label,
  onPress,
  tone = 'link',
  testID,
}: {
  label: string;
  onPress: () => void;
  tone?: 'link' | 'dangerInk';
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => [styles.small, pressed && { backgroundColor: colors.surface2 }]}>
      <Text variant="callout" tone={tone} style={styles.strong}>
        {label}
      </Text>
    </Pressable>
  );
}

export function RecordingCard({ recording, onOpen }: { recording: Recording; onOpen: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const live = useRecorderClock(recording.phase === 'recording');
  const time = clock(recording.phase === 'recording' ? live.durationMs : recording.durationMs);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('mom.openRecorder')}
      onPress={onOpen}
      testID="recording-card"
      style={({ pressed }) => [styles.live, { backgroundColor: pressed ? colors.dangerBand : colors.surface, borderColor: colors.danger }]}>
      <View style={[styles.dot, { backgroundColor: colors.danger }]} />
      <View style={styles.lineText}>
        <Text variant="callout" style={styles.strong} numberOfLines={1}>
          {recording.title}
        </Text>
        <Text variant="footnote" tone="dangerInk">
          {recording.phase === 'paused' ? t('mom.pausedNow', { time }) : t('mom.recordingNow', { time })}
        </Text>
      </View>
      <Text variant="callout" tone="link" style={styles.strong}>
        {t('mom.openRecorder')}
      </Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  fill: { flex: 1 },
  strong: { fontWeight: '600' },
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  bar: { width: 4, borderRadius: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.md },
  lineIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  lineText: { flex: 1, gap: 3 },
  track: { height: 6, borderRadius: radius.pill, overflow: 'hidden' },
  fillBar: { height: 6 },
  upload: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.md },
  uploadTop: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: space.sm },
  small: { minHeight: 44, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.pill },
  live: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, padding: space.lg, borderRadius: radius.card, borderWidth: 1 },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
