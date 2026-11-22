import { useCallback, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useLanguage } from '../../i18n';
import { intlLocale } from '../../i18n/language';
import { radius, space, useTheme, type Colors } from '../../theme';
import { Icon, type IconName } from '../../ui/icons';
import type { RowBind } from '../../ui/RowActions';
import { Text } from '../../ui/Text';
import { Chip } from '../discovery/ui';
import type { MeetingRow } from './api';
import { clock, useRecorderClock, type Recording } from './recorder';
import { isPending, sentBytes, type Upload } from './upload';
import { discard, dismiss, retry } from './uploads';

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

type StatusRow = Pick<MeetingRow, 'chip' | 'chipLabel'> & { final?: { state: string; status: string } };

function finalOf(row: StatusRow) {
  return row.final && row.final.state !== 'draft' ? row.final : null;
}

export function useStatusLabel() {
  const { t } = useTranslation();
  return (row: StatusRow): string => {
    const final = finalOf(row);
    if (final) return t(`mom.stage.${final.state}` as never, { defaultValue: final.status }) as string;
    return t(`mom.chip.${row.chip}` as never, { defaultValue: row.chipLabel }) as string;
  };
}

export function MeetingChip({ row }: { row: StatusRow }) {
  const label = useStatusLabel();
  const final = finalOf(row);
  return <Chip tone={final ? (finalTones[final.state] ?? 'neutral') : (chipTones[row.chip] ?? 'neutral')} label={label(row)} />;
}

const finalIcons: Record<string, IconName> = { reviewed: 'sign', final: 'check', distributed: 'checkDouble' };
const chipIcons: Record<string, [IconName, keyof Colors]> = {
  not_ready: ['clock', 'inkFaint'],
  ready: ['doc', 'infoInk'],
  generating: ['sparkle', 'selectInk'],
  generated: ['check', 'okInk'],
  locked: ['check', 'okInk'],
};

export function needsAction(row: StatusRow): boolean {
  return !finalOf(row) && (row.chip === 'failed' || row.chip === 'stale');
}

export function MeetingStatusIcon({ row }: { row: StatusRow }) {
  const { colors } = useTheme();
  const final = finalOf(row);
  const [icon, tone]: [IconName, keyof Colors] = final ? [finalIcons[final.state] ?? 'check', 'okInk'] : (chipIcons[row.chip] ?? ['clock', 'inkFaint']);
  return <Icon name={icon} size={16} color={colors[tone]} />;
}

export function Line({
  icon,
  title,
  detail,
  trailing,
  end,
  label,
  onPress,
  selected,
  testID,
  bind,
}: {
  bind?: RowBind;
  icon: IconName;
  title: string;
  detail?: string;
  trailing?: ReactNode;
  end?: ReactNode;
  label?: string;
  onPress?: () => void;
  selected?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      {...bind}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={selected === undefined ? undefined : { selected }}
      disabled={!onPress}
      onPress={onPress}
      testID={testID}
      android_ripple={{ color: colors.select }}
      style={({ pressed }) => [
        styles.line,
        (pressed || selected) ? { backgroundColor: selected ? colors.select : colors.surface2 } : bind && { backgroundColor: colors.surface },
      ]}>
      <View style={[styles.lineIcon, { backgroundColor: colors.surface2 }]}>
        <Icon name={icon} size={20} color={colors.selectInk} />
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
      {end}
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
        <Icon name={upload.state === 'done' ? 'check' : 'cloudUpload'} color={uploadTone(upload.state, colors)} />
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
