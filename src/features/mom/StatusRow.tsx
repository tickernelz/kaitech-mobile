import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { radius, space, useTheme } from '../../theme';
import { Icon } from '../../ui/icons';
import { Text } from '../../ui/Text';
import { useErrorText } from '../discovery/ui';
import { MoreSheet, type MoreAction } from './MoreSheet';
import { meetingOfRecording, processingSummary, type StatusItem } from './records';

const busyEveryMs = 20_000;

export function StatusRow({ onOpenMeeting }: { onOpenMeeting: (meeting: number) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { active } = useSession();
  const errorText = useErrorText();
  const summary = useResource('mom.status', processingSummary, 15_000);
  const [open, setOpen] = useState(false);
  const [problem, setProblem] = useState('');
  const processing = summary.data?.processing ?? 0;
  const failed = summary.data?.failed ?? 0;
  const refresh = summary.refresh;

  useFocusEffect(
    useCallback(() => {
      if (!processing) return undefined;
      const timer = setInterval(() => void refresh(), busyEveryMs);
      return () => clearInterval(timer);
    }, [processing, refresh]),
  );

  if (!processing && !failed) return null;

  const openItem = async (item: StatusItem) => {
    if (!active) return;
    try {
      const meeting = await meetingOfRecording(active, item.id);
      if (meeting) onOpenMeeting(meeting);
      else setProblem(t('mom.status.noMeeting'));
    } catch (error) {
      setProblem(errorText(error));
    }
  };
  const actionOf = (item: StatusItem, failing: boolean): MoreAction => ({
    key: `${failing ? 'failed' : 'working'}-${item.id}`,
    icon: failing ? 'alert' : 'wave',
    label: item.title,
    detail: failing
      ? item.failures.map((failure) => `${failure.step}: ${failure.note || '-'}`).join(' · ')
      : [item.programme, item.steps.join(', ')].filter(Boolean).join(' · '),
    tone: failing ? 'danger' : undefined,
    onPress: () => void openItem(item),
  });
  const parts = [processing ? t('mom.status.processing', { count: processing }) : '', failed ? t('mom.status.failed', { count: failed }) : ''].filter(Boolean);

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={parts.join(', ')}
        accessibilityHint={t('mom.status.hint')}
        onPress={() => {
          setProblem('');
          setOpen(true);
          void refresh();
        }}
        style={({ pressed }) => [styles.row, { borderColor: colors.line, backgroundColor: pressed ? colors.surface2 : colors.surface }]}
        testID="mom-status">
        <Icon name={failed ? 'alert' : 'wave'} size={20} color={failed ? colors.dangerInk : colors.selectInk} />
        <Text variant="callout" style={styles.flex}>
          {parts.join(' · ')}
        </Text>
        <Icon name="forward" size={18} color={colors.inkFaint} />
      </Pressable>
      {problem ? (
        <Text variant="footnote" tone="dangerInk" accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}
      {open && summary.data ? (
        <MoreSheet
          title={t('mom.status.title')}
          groups={[
            { key: 'working', title: t('mom.status.processing', { count: processing }), actions: summary.data.working.map((item) => actionOf(item, false)) },
            { key: 'failing', title: t('mom.status.failed', { count: failed }), actions: summary.data.failing.map((item) => actionOf(item, true)) },
          ]}
          onClose={() => setOpen(false)}
          testID="mom-status-sheet"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48, paddingHorizontal: space.lg, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth },
});
