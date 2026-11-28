import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSession } from '../../auth/session';
import { radius, space, stroke, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Sheet, SheetItem } from '../../ui/Sheet';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Icon, type IconName } from '../../ui/icons';
import { coworkerFallbackBytes } from '../chat/uploadRule';
import { useErrorText } from '../discovery/ui';
import { DateGrid } from './DateGrid';
import { useDueLabel } from './due';
import { iconOfCategory } from './icons';
import { attach, cancel, edit, markDone, markDoneAndNext, snooze, type Activity, type NextStep, type Snooze } from './odoo';
import { confirm } from '../../ui/dialog';

export const documentMaxBytes = coworkerFallbackBytes;

export function ActivitySheet({
  activity,
  onClose,
  onChanged,
  onEdit,
  onNext,
  onOpenRecord,
}: {
  activity: Activity;
  onClose: () => void;
  onChanged: () => void;
  onEdit: () => void;
  onNext: (next: NonNullable<NextStep>) => void;
  onOpenRecord: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const errorText = useErrorText();
  const due = useDueLabel();
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [later, setLater] = useState<'menu' | 'date' | null>(null);
  const [date, setDate] = useState(activity.deadline);
  const locked = !activity.canWrite;

  const run = async (work: () => Promise<unknown>, after: () => void = onChanged) => {
    if (!active || busy) return;
    setBusy(true);
    setFailed(null);
    try {
      await work();
      after();
    } catch (error) {
      setFailed(errorText(error));
      setBusy(false);
    }
  };

  const done = () => active && run(() => markDone(active, activity.id, feedback));

  const doneAndNext = () =>
    active &&
    run(
      async () => {
        const next = await markDoneAndNext(active, activity, feedback);
        if (next) onNext(next);
        else onChanged();
      },
      () => undefined,
    );

  const upload = async () => {
    if (!active || busy) return;
    const picked = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const file = new File(asset.uri);
    if ((asset.size ?? file.size ?? 0) > documentMaxBytes) {
      if (file.exists) file.delete();
      setFailed(t('activities.tooBig', { size: Math.round(documentMaxBytes / 1024 / 1024) }));
      return;
    }
    await run(async () => {
      try {
        const id = await attach(active, activity, { name: asset.name, mimetype: asset.mimeType ?? 'application/octet-stream', base64: await file.base64() });
        await markDone(active, activity.id, feedback, [id]);
      } finally {
        if (file.exists) file.delete();
      }
    });
  };

  const postpone = (when: Snooze) => active && run(() => snooze(active, activity.id, when));

  const moveTo = () =>
    active && run(() => edit(active, activity.id, { typeId: activity.typeId, summary: activity.summary, note: activity.note, deadline: date, userId: activity.userId }));

  const confirmCancel = async () => {
    const go = await confirm({ body: t('activities.cancelConfirm'), cancel: t('activities.keep'), confirm: t('activities.cancel'), danger: true, icon: 'close', testID: 'activity-cancel-dialog' });
    if (go && active) void run(() => cancel(active, activity.id));
  };

  return (
    <Sheet title={activity.summary || activity.typeName} detail={[activity.modelName, activity.resName].filter(Boolean).join(' · ')} onClose={onClose} testID="activity-sheet">
      <View style={styles.facts}>
        <Fact icon={iconOfCategory(activity.category)} text={activity.typeName} />
        <Fact icon="clock" text={due(activity.deadline)} danger={activity.state === 'overdue'} />
        {activity.userName ? <Fact icon="people" text={activity.userName} /> : null}
        {activity.note ? (
          <Text variant="body" tone="inkSoft" selectable testID="activity-sheet-note">
            {activity.note}
          </Text>
        ) : null}
      </View>
      {locked ? (
        <Text variant="footnote" tone="inkSoft" testID="activity-sheet-readonly">
          {t('activities.readOnly')}
        </Text>
      ) : (
        <View style={styles.primary}>
          <TextField label={t('activities.feedback')} value={feedback} onChangeText={setFeedback} multiline maxLength={2000} testID="activity-feedback" />
          {activity.category === 'upload_file' ? (
            <Button label={t('activities.uploadDone')} busy={busy} onPress={() => void upload()} testID="activity-upload" />
          ) : (
            <Button label={t('activities.markDone')} busy={busy} onPress={() => void done()} testID="activity-done" />
          )}
        </View>
      )}
      {!locked ? <SheetItem icon="steps" label={t('activities.doneAndNext')} onPress={() => void doneAndNext()} disabled={busy} testID="activity-done-next" /> : null}
      {!locked ? <SheetItem icon="clock" label={t('activities.snooze.title')} onPress={() => setLater(later ? null : 'menu')} disabled={busy} testID="activity-snooze" /> : null}
      {later ? (
        <View style={[styles.nested, { borderColor: colors.line }]}>
          <SheetItem icon="clock" label={t('activities.snooze.today')} onPress={() => void postpone('today')} disabled={busy} testID="activity-snooze-today" />
          <SheetItem icon="clock" label={t('activities.snooze.tomorrow')} onPress={() => void postpone('tomorrow')} disabled={busy} testID="activity-snooze-tomorrow" />
          <SheetItem icon="clock" label={t('activities.snooze.nextweek')} onPress={() => void postpone('nextweek')} disabled={busy} testID="activity-snooze-nextweek" />
          <SheetItem icon="filter" label={t('activities.pickDate')} onPress={() => setLater(later === 'date' ? 'menu' : 'date')} disabled={busy} testID="activity-snooze-pick" />
          {later === 'date' ? (
            <>
              <DateGrid value={date} onChange={setDate} testID="activity-snooze-date" />
              <Button kind="secondary" label={t('activities.moveTo', { date: due(date) })} busy={busy} onPress={() => void moveTo()} testID="activity-snooze-save" />
            </>
          ) : null}
        </View>
      ) : null}
      {!locked ? <SheetItem icon="sign" label={t('activities.edit')} onPress={onEdit} disabled={busy} testID="activity-edit" /> : null}
      {activity.resId ? <SheetItem icon="external" label={t('activities.openRecord')} onPress={onOpenRecord} disabled={busy} testID="activity-open-record" /> : null}
      {!locked ? <SheetItem icon="trash" label={t('activities.cancel')} onPress={confirmCancel} disabled={busy} danger testID="activity-cancel" /> : null}
      <View style={styles.foot}>
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
        {failed ? (
          <Text variant="footnote" tone="dangerInk" accessibilityLiveRegion="polite" testID="activity-sheet-error">
            {failed}
          </Text>
        ) : null}
      </View>
    </Sheet>
  );
}

function Fact({ icon, text, danger }: { icon: IconName; text: string; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fact}>
      <Icon name={icon} size={18} color={danger ? colors.dangerInk : colors.inkSoft} />
      <Text variant="callout" style={{ color: danger ? colors.dangerInk : colors.ink }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: { gap: space.sm, paddingHorizontal: space.sm, paddingBottom: space.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  primary: { gap: space.sm, paddingBottom: space.sm },
  nested: { borderWidth: stroke.thin, borderRadius: radius.md, padding: space.xs, gap: space.xs },
  foot: { minHeight: space.lg, alignItems: 'center', justifyContent: 'center' },
});
