import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useResource } from '../../api/resource';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { Card, Chip, StateView } from '../discovery/ui';
import { finalMinutes, type FinalView } from './api';
import { MomIcon } from './parts';

export function finalKey(meeting: number) {
  return `mom.final.${meeting}`;
}

export function useFinal(programme: number, meeting: number) {
  return useResource(finalKey(meeting), (account) => finalMinutes(account, programme, meeting));
}

function Stages({ view }: { view: FinalView }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const at = view.stages.findIndex((stage) => stage.key === view.state);
  return (
    <View style={styles.stages} accessibilityRole="progressbar" accessibilityLabel={t(`mom.stage.${view.state}` as never, { defaultValue: view.status }) as string}>
      {view.stages.map((stage, index) => {
        const done = index < at;
        const current = index === at;
        return (
          <View
            key={stage.key}
            style={[
              styles.stage,
              {
                backgroundColor: current ? colors.primary : done ? colors.okBand : colors.surface,
                borderColor: current ? colors.primary : done ? colors.okBand : colors.line,
              },
            ]}
            testID={`stage-${stage.key}`}>
            {done ? <MomIcon name="check" size={16} color={colors.okInk} /> : null}
            <Text variant="label" style={{ color: current ? colors.onPrimary : done ? colors.okInk : colors.inkSoft }}>
              {t(`mom.stage.${stage.key}` as never, { defaultValue: stage.label }) as string}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Paper({ view }: { view: FinalView }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const points = view.paper.points ?? [];
  return (
    <Card testID="final-paper">
      <Text variant="headline">{view.paper.documentTitle}</Text>
      <Text variant="footnote" tone="inkSoft">
        {[view.meeting, view.programme, view.paper.meetingDate, t('mom.final.version', { version: view.versionLabel })].filter(Boolean).join(' · ')}
      </Text>
      {points.length ? (
        <View style={[styles.table, { borderColor: colors.line }]}>
          <View style={[styles.tableRow, { backgroundColor: colors.primary }]}>
            <Text variant="label" style={[styles.number, { color: colors.onPrimary }]}>
              {t('mom.final.number')}
            </Text>
            <Text variant="label" style={[styles.cell, { color: colors.onPrimary }]}>
              {t('mom.final.item')}
            </Text>
            <Text variant="label" style={[styles.cell, { color: colors.onPrimary }]}>
              {t('mom.final.check')}
            </Text>
          </View>
          {points.map((point, index) => (
            <View key={index} style={[styles.tableRow, { borderColor: colors.line }, styles.tableLine]}>
              <Text variant="footnote" style={styles.number}>
                {point.kode || String(index + 1)}
              </Text>
              <Text variant="footnote" style={styles.cell}>
                {point.judul ?? ''}
              </Text>
              <Text variant="footnote" style={styles.cell}>
                {(point.caraMengecek ?? []).join('\n')}
              </Text>
            </View>
          ))}
        </View>
      ) : view.paper.decisions?.length ? (
        <View style={styles.list}>
          <Text variant="label" tone="inkSoft">
            {t('mom.final.decisions')}
          </Text>
          {view.paper.decisions.map((line, index) => (
            <Text key={index} variant="callout">{`${index + 1}. ${line}`}</Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function FinalPanel({ programme, meeting }: { programme: number; meeting: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const final = useFinal(programme, meeting);
  const view = final.data;
  if (!view) {
    return <StateView loading={final.loading || !final.error} error={final.error} onRetry={() => void final.refresh()} testID="final" />;
  }
  const ready = view.readiness.generated && !view.readiness.generating && !view.readiness.problems.length;
  const canSign = view.state === 'draft' && view.canChange;
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={final.loading} onRefresh={() => void final.refresh()} />}
      testID="final-panel">
      <Stages view={view} />
      {view.readiness.generated ? <Paper view={view} /> : <Text tone="inkSoft">{t('mom.final.empty')}</Text>}
      <Section title={t('mom.final.signoff')}>
        <View style={styles.signer}>
          <Text variant="callout" style={styles.fill}>
            {view.signoff && view.signedBy ? t('mom.final.signedBy', { name: view.signedBy }) : t('mom.final.notSigned')}
          </Text>
          <Chip tone={view.signoff ? 'ok' : 'warn'} label={view.signoff ? t('mom.final.signed') : t('mom.final.notSigned')} />
        </View>
      </Section>
      {view.drift ? <Text tone="warnInk">{t('mom.final.drift')}</Text> : null}
      {canSign && !ready ? (
        <View style={styles.list} testID="final-not-ready">
          <Text variant="callout" tone="warnInk">
            {t('mom.final.notReady')}
          </Text>
          {view.readiness.problems.map((problem, index) => (
            <Text key={index} variant="footnote" tone="inkSoft">
              {problem}
            </Text>
          ))}
        </View>
      ) : null}
      {canSign && view.awaitingKnowledge ? (
        <Text variant="footnote" tone="inkSoft">
          {t('mom.final.awaiting', { count: view.awaitingKnowledge })}
        </Text>
      ) : null}
      {canSign ? (
        <Button
          label={t('mom.final.sign')}
          disabled={!ready}
          onPress={() => router.push({ pathname: '/mom/sign', params: { programme: String(programme), meeting: String(meeting) } })}
          testID="final-sign"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: readableWidth, alignSelf: 'center', paddingBottom: space.xxl },
  stages: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  stage: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 36, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1 },
  table: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.sm, paddingVertical: space.sm },
  tableLine: { borderTopWidth: StyleSheet.hairlineWidth },
  number: { width: 56 },
  cell: { flex: 1 },
  list: { gap: space.xs },
  signer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});
