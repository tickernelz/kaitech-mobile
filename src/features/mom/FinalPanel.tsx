import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { sessionCookie } from '../../api/odoo';
import { invalidate, useResource } from '../../api/resource';
import type { Account } from '../../auth/oauth';
import { useSession } from '../../auth/session';
import { downloadForOpening } from '../chat/files';
import { distribute, exportMinutes, finalize, nextStep, stepBlocker, type FinalTool } from './final';
import { MoreSheet, type MoreAction, type MoreGroup } from './MoreSheet';
import { SmallButton } from './parts';
import { readableWidth } from '../../layout/windowClass';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/icons';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { Card, Chip, StateView, useErrorText } from '../discovery/ui';
import { finalMinutes, type FinalView } from './api';
import { Refresh } from '../../ui/Refresh';
import { confirm, notify } from '../../ui/dialog';

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
            {done ? <Icon name="check" size={16} color={colors.okInk} /> : null}
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

async function openExport(account: Account, meeting: number, format: 'docx' | 'pdf', complete: boolean) {
  const file = await exportMinutes(account, meeting, format, complete);
  const url = file.url.startsWith('http') ? file.url : `${account.origin}${file.url}`;
  const local = await downloadForOpening(
    { accountId: account.id, attachmentId: file.attachmentId, checksum: String(Date.now()) },
    url,
    file.name,
    { Cookie: await sessionCookie(account) },
  );
  const mimeType = format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (await local.canPreview({ mimeType })) await local.preview({ mimeType, title: file.name });
  else if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(local.uri, { mimeType, dialogTitle: file.name });
}

function useFinalActions(programme: number, view: FinalView) {
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const { active } = useSession();
  const [busy, setBusy] = useState('');
  const run = async (name: string, work: (account: Account) => Promise<unknown>) => {
    if (!active || busy) return;
    setBusy(name);
    try {
      await work(active);
      invalidate(`${active.id}:${finalKey(view.meetingId)}`);
      invalidate(`${active.id}:mom.board`);
    } catch (error) {
      notify(errorText(error));
    } finally {
      setBusy('');
    }
  };
  const tool = (name: FinalTool) => () =>
    router.push({ pathname: '/mom/final/[tool]', params: { tool: name, programme: String(programme), meeting: String(view.meetingId) } });
  const download = (format: 'docx' | 'pdf', complete: boolean) => () =>
    void run(`export-${format}-${complete}`, (account) => openExport(account, view.meetingId, format, complete));
  const team = !view.isClient;
  type Key = 'content' | 'narrative' | 'header' | 'recipients' | 'email' | 'docx' | 'pdf' | 'complete' | 'context' | 'revoke';
  const action = (key: Key, icon: MoreAction['icon'], onPress: () => void, extra: Partial<MoreAction> = {}): MoreAction => ({
    key,
    icon,
    label: t(`mom.finalTools.menu.${key}`),
    onPress,
    ...extra,
  });
  const groups: MoreGroup[] = [
    {
      key: 'content',
      title: t('mom.finalTools.menu.contentGroup'),
      actions: team ? [action('content', 'doc', tool('content')), action('narrative', 'minutes', tool('narrative')), action('header', 'meeting', tool('header'))] : [],
    },
    {
      key: 'send',
      title: t('mom.finalTools.menu.sendGroup'),
      actions: team ? [action('recipients', 'people', tool('recipients')), action('email', 'send', tool('email'))] : [],
    },
    {
      key: 'files',
      title: t('mom.finalTools.menu.filesGroup'),
      actions: [
        action('docx', 'download', download('docx', false)),
        action('pdf', 'download', download('pdf', false)),
        ...(team ? [action('complete', 'download', download('docx', true), { detail: t('mom.finalTools.menu.completeDetail') })] : []),
      ],
    },
    {
      key: 'more',
      title: t('mom.finalTools.menu.moreGroup'),
      actions: [
        ...(team ? [action('context', 'history', tool('context'))] : []),
        ...(view.canChange && view.state !== 'draft' ? [action('revoke', 'retry', tool('revoke'), { tone: 'danger' })] : []),
      ],
    },
  ];
  const step = nextStep(view);
  const askStep = async (key: 'finalize' | 'distribute' | 'distributeRest', work: (account: Account) => Promise<unknown>) => {
    const go = await confirm({
      title: t(`mom.finalTools.step.${key}Title`),
      body: t(`mom.finalTools.step.${key}Body`),
      cancel: t('mom.recorder.cancel'),
      confirm: t(`mom.finalTools.step.${key}`),
      icon: key === 'finalize' ? 'sign' : 'share',
      testID: 'final-step-dialog',
    });
    if (go) void run(key, work);
  };
  const stepPress =
    step === 'finalize'
      ? () => void askStep('finalize', (account) => finalize(account, view.documentId))
      : step === 'distribute' || step === 'distributeRest'
        ? () => void askStep(step, (account) => distribute(account, view.documentId))
        : undefined;
  return { groups, busy, step, stepPress };
}

function NextStepButton({ view, programme }: { view: FinalView; programme: number }) {
  const { t } = useTranslation();
  const actions = useFinalActions(programme, view);
  const [open, setOpen] = useState(false);
  const step = actions.step;
  const blocker = step && step !== 'sign' ? stepBlocker(view, step) : null;
  return (
    <View style={styles.list}>
      {step && step !== 'sign' && actions.stepPress ? (
        <Button label={t(`mom.finalTools.step.${step}`)} disabled={!!blocker} busy={actions.busy === step} onPress={actions.stepPress} testID={`final-step-${step}`} />
      ) : null}
      {blocker ? (
        <Text variant="footnote" tone="inkSoft">
          {t(`mom.finalTools.blocker.${blocker}`)}
        </Text>
      ) : null}
      {actions.busy.startsWith('export') ? (
        <Text variant="footnote" tone="inkSoft" accessibilityRole="alert">
          {t('mom.finalTools.exporting')}
        </Text>
      ) : null}
      <SmallButton label={t('mom.finalTools.menu.title')} onPress={() => setOpen(true)} testID="final-options" />
      {open ? <MoreSheet title={t('mom.finalTools.menu.title')} groups={actions.groups} onClose={() => setOpen(false)} testID="final-options-sheet" /> : null}
    </View>
  );
}

export function FinalPanel({ programme, meeting, header }: { programme: number; meeting: number; header?: ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const final = useFinal(programme, meeting);
  const view = final.data;
  if (!view) {
    return (
      <View style={styles.fill}>
        {header}
        <StateView loading={final.loading || !final.error} error={final.error} onRetry={() => void final.refresh()} testID="final" />
      </View>
    );
  }
  const ready = view.readiness.generated && !view.readiness.generating && !view.readiness.problems.length;
  const canSign = view.state === 'draft' && view.canChange;
  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<Refresh refreshing={final.loading} onRefresh={() => void final.refresh()} />}
      testID="final-panel">
      {header}
      <View style={styles.body}>
        <Stages view={view} />
      {view.readiness.generated ? <Paper view={view} /> : <Text tone="inkSoft">{t('mom.final.empty')}</Text>}
      <Section title={t('mom.final.signoff')}>
        <View style={styles.signer}>
          <Text variant="callout" style={styles.fill}>
            {view.signoff && view.signedBy ? t('mom.final.signedBy', { name: view.signedBy }) : t('mom.final.notSigned')}
          </Text>
          {view.signoff ? <Chip tone="ok" label={t('mom.final.signed')} /> : null}
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
      <NextStepButton view={view} programme={programme} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingBottom: space.xxl },
  body: { padding: space.lg, gap: space.lg, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
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
