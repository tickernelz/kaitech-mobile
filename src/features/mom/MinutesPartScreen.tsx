import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { readableWidth } from '../../layout/windowClass';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { Header } from '../discovery/Header';
import { Card, Chip, StateView, useErrorText } from '../discovery/ui';
import { minutesDetail, type Detail, type Hint } from './api';
import { contextBlocks, decideHint, documentBlocks, dynamicsBlocks, type Block, type MinutesPart } from './minutes';

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block) => (
        <Section key={block.title} title={block.title}>
          {block.lines.map((line, index) => (
            <View key={index} style={styles.line}>
              <Text selectable>{line}</Text>
            </View>
          ))}
        </Section>
      ))}
    </>
  );
}

function Hints({ detail }: { detail: Detail }) {
  const { t } = useTranslation();
  const errorText = useErrorText();
  const { active } = useSession();
  const [busy, setBusy] = useState(0);
  const [problem, setProblem] = useState('');
  const decide = async (hint: Hint, confirm: boolean) => {
    if (!active || busy) return;
    setBusy(hint.id);
    setProblem('');
    try {
      await decideHint(active, hint.id, confirm);
      invalidate(`${active.id}:mom.detail.${detail.meeting_id}`);
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setBusy(0);
    }
  };
  const hints = detail.milestones ?? [];
  if (!hints.length) return <StateView empty={{ title: t('mom.minutesParts.noHints'), icon: 'flag' }} />;
  return (
    <>
      {problem ? (
        <Text tone="dangerInk" accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}
      {hints.map((hint) => (
        <Card key={hint.id} testID={`hint-${hint.id}`}>
          <View style={styles.row}>
            <Chip label={hint.status} tone={hint.state === 'pending' ? 'info' : 'neutral'} />
          </View>
          <Text variant="headline">{hint.task}</Text>
          <Text variant="footnote" tone="inkSoft">
            {[hint.planned_end ? t('mom.minutesParts.planned', { day: hint.planned_end }) : '', hint.realized_on ? t('mom.minutesParts.realized', { day: hint.realized_on }) : '', hint.decided_by]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {hint.quote ? <Text variant="callout">{`"${hint.quote}"`}</Text> : null}
          {hint.reason ? <Text variant="callout" tone="inkSoft">{hint.reason}</Text> : null}
          {hint.state === 'pending' && detail.canDecide ? (
            <View style={styles.row}>
              <Button label={t('mom.minutesParts.confirm')} onPress={() => void decide(hint, true)} busy={busy === hint.id} style={styles.flex} testID={`hint-confirm-${hint.id}`} />
              <Button kind="secondary" label={t('mom.minutesParts.dismiss')} onPress={() => void decide(hint, false)} disabled={!!busy} style={styles.flex} testID={`hint-dismiss-${hint.id}`} />
            </View>
          ) : null}
        </Card>
      ))}
    </>
  );
}

export function MinutesPartScreen({ part, meeting }: { part: MinutesPart; meeting: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const detail = useResource(`mom.detail.${meeting}`, (account) => minutesDetail(account, meeting));
  const label = (key: string) => t(`mom.minutesParts.${part}.${key}` as never) as string;
  const data = detail.data;
  const blocks = !data
    ? []
    : part === 'document'
      ? documentBlocks(data.minutes, label)
      : part === 'dynamics'
        ? dynamicsBlocks(data.dynamics, label)
        : part === 'context'
          ? contextBlocks(data.context, label)
          : [];
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID={`minutes-${part}`}>
      <Header title={t(`mom.minutesParts.${part}.title`)} subtitle={data?.meeting} />
      <ScrollView contentContainerStyle={styles.content}>
        {!data ? (
          <StateView loading={!detail.error} error={detail.error} onRetry={() => void detail.refresh()} testID="minutes-part" />
        ) : part === 'milestones' ? (
          <Hints detail={data} />
        ) : blocks.length ? (
          <Blocks blocks={blocks} />
        ) : (
          <StateView empty={{ title: t('mom.minutesParts.empty'), icon: 'minutes' }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' },
  line: { paddingHorizontal: space.lg, paddingVertical: space.md },
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
