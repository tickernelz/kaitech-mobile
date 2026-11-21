import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Row, Section } from '../../ui/List';
import { Slider } from '../../ui/Slider';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { Card, StateView, useErrorText } from '../discovery/ui';
import { StatusChip, useDueLabel } from './followupParts';
import { agree, archive, canWork, followupItem, markDone, recordProgress, type FollowupItem } from './followups';
import { MoreSheet } from './MoreSheet';

export function FollowupScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const errorText = useErrorText();
  const due = useDueLabel();
  const { active } = useSession();
  const item = useResource(`mom.followup.${id}`, (account) => followupItem(account, id));
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [percent, setPercent] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const data = item.data;

  const act = async (name: string, run: () => Promise<unknown>) => {
    if (!active || busy) return;
    setBusy(name);
    setProblem('');
    try {
      await run();
      invalidate(`${active.id}:mom.followup`);
      return true;
    } catch (error) {
      setProblem(errorText(error));
      return false;
    } finally {
      setBusy('');
    }
  };

  if (!data) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="mom-followup">
        <Header title={t('mom.followups.title')} />
        <StateView loading={!item.error} error={item.error} onRetry={() => void item.refresh()} testID="followup" />
      </SafeAreaView>
    );
  }

  const working = canWork(data);
  const ready = !!data.owner && !!data.deadline;
  const shownPercent = percent ?? data.progress;
  const primary =
    data.archived ? null : data.status === 'draft' ? (
      <View style={styles.block}>
        <Button label={t('mom.followups.agree')} onPress={() => void act('agree', () => agree(active!, data.id))} disabled={!ready} busy={busy === 'agree'} testID="followup-agree" />
        {!ready ? (
          <Text variant="footnote" tone="inkSoft">
            {t('mom.followups.agreeHint')}
          </Text>
        ) : null}
      </View>
    ) : data.status === 'open' || data.status === 'late' ? (
      <Button label={t('mom.followups.done')} onPress={() => void act('done', () => markDone(active!, data.id))} busy={busy === 'done'} testID="followup-done" />
    ) : null;

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="mom-followup">
      <Header
        title={data.code || t('mom.followups.title')}
        subtitle={data.meeting ? data.meeting.name : undefined}
        actions={<IconButton icon="more" label={t('mom.menu.title')} onPress={() => setMoreOpen(true)} testID="followup-more" />}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={item.loading} onRefresh={() => void item.refresh()} />}>
        <View style={styles.block}>
          <Text variant="title" testID="followup-name">
            {data.name}
          </Text>
          <View style={styles.row}>
            <StatusChip row={data} />
            {data.urgencyLabel ? (
              <Text variant="footnote" tone="inkSoft">
                {data.urgencyLabel}
              </Text>
            ) : null}
          </View>
        </View>
        <Section>
          <Row title={t('mom.followups.owner')} detail={data.owner ? data.owner.name : data.ownerSaid || t('mom.followups.nobody')} />
          <Row title={t('mom.followups.due')} detail={due(data)} />
          <Row title={t('mom.followups.progress')} detail={`${data.progress}%`} />
          {data.topic ? <Row title={t('mom.followups.topic')} detail={data.topic} /> : null}
          {data.minutes.id ? <Row title={t('mom.followups.minutes')} detail={data.minutes.name} /> : null}
          {data.draftedBy ? <Row title={t('mom.followups.draftedBy')} detail={data.draftedBy} /> : null}
        </Section>
        {data.detail ? <Text>{data.detail}</Text> : null}
        {[data.settledNote, data.reportedNote].filter(Boolean).map((line) => (
          <Card key={line}>
            <Text variant="callout">{line}</Text>
          </Card>
        ))}
        {problem ? (
          <Text variant="callout" tone="dangerInk" accessibilityRole="alert">
            {problem}
          </Text>
        ) : null}
        {primary}
        {working ? (
          <Card testID="followup-progress">
            <Text variant="headline">{t('mom.followups.recordProgress')}</Text>
            <Text tone="inkSoft">{`${shownPercent}%`}</Text>
            <Slider value={shownPercent} max={100} label={t('mom.followups.progress')} onChange={(next) => setPercent(Math.round(next / 5) * 5)} testID="followup-percent" />
            <TextField label={t('mom.followups.note')} value={note} onChangeText={setNote} multiline testID="followup-note" />
            <Button
              kind="secondary"
              label={t('mom.followups.saveProgress')}
              busy={busy === 'progress'}
              disabled={percent === null && !note.trim()}
              onPress={() =>
                void act('progress', () => recordProgress(active!, data.id, shownPercent, note.trim())).then((ok) => {
                  if (ok) {
                    setPercent(null);
                    setNote('');
                  }
                })
              }
              testID="followup-save-progress"
            />
          </Card>
        ) : null}
        <History item={data} />
      </ScrollView>
      {moreOpen ? (
        <MoreSheet
          title={t('mom.menu.title')}
          groups={[
            {
              key: 'item',
              actions: [
                ...(working ? [{ key: 'edit', icon: 'steps' as const, label: t('mom.followups.edit'), onPress: () => router.push({ pathname: '/mom/followup/edit', params: { id: String(data.id) } }) }] : []),
                data.archived
                  ? { key: 'restore', icon: 'retry' as const, label: t('mom.followups.restore'), onPress: () => void act('archive', () => archive(active!, data.id, false)) }
                  : { key: 'archive', icon: 'trash' as const, label: t('mom.followups.archive'), tone: 'danger' as const, onPress: () => void act('archive', () => archive(active!, data.id, true)) },
              ],
            },
          ]}
          onClose={() => setMoreOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function History({ item }: { item: FollowupItem }) {
  const { t } = useTranslation();
  if (!item.history.length) return null;
  return (
    <Section title={t('mom.followups.history')}>
      {item.history.map((entry) => (
        <Row
          key={entry.id}
          title={[entry.percent !== false ? `${entry.percent}%` : '', entry.note].filter(Boolean).join(' · ') || entry.originLabel}
          detail={[entry.quote ? `"${entry.quote}"` : '', [entry.by, entry.meeting ? entry.meeting.name : '', entry.saidOn || entry.at].filter(Boolean).join(' · ')].filter(Boolean).join('\n')}
        />
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  block: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
