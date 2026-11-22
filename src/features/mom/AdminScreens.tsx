import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { invalidate, useResource } from '../../api/resource';
import type { Account } from '../../auth/oauth';
import { useSession } from '../../auth/session';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Row, Section, ToggleRow } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { Card, StateView, useErrorText } from '../discovery/ui';
import {
  decideProject,
  importOverview,
  readSettings,
  resetPrompt,
  rollBack,
  runDetail,
  savePrompt,
  saveRate,
  saveTranscription,
  testLark,
  thresholdProblem,
  type ImportProject,
  type Settings,
} from './admin';
import { Scroll } from './assistParts';
import { ChoiceRow } from './followupParts';
import { McpKeysScreen } from './McpKeysScreen';
import { MoreSheet } from './MoreSheet';
import { SmallButton } from './parts';

export type AdminPart = 'keys' | 'settings' | 'import';

const vendors = ['deepgram', 'openai', 'elevenlabs'] as const;

function useAdminRun(key: string) {
  const { active } = useSession();
  const errorText = useErrorText();
  const [busy, setBusy] = useState('');
  const run = async <T,>(name: string, work: (account: Account) => Promise<T>): Promise<T | undefined> => {
    if (!active || busy) return undefined;
    setBusy(name);
    try {
      const answer = await work(active);
      invalidate(`${active.id}:${key}`);
      return answer;
    } catch (error) {
      Alert.alert('', errorText(error));
      return undefined;
    } finally {
      setBusy('');
    }
  };
  return { busy, run };
}

export function AdminScreen({ part }: { part: AdminPart }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID={`admin-${part}`}>
      <Header title={t(`mom.admin.${part}.title`)} />
      {part === 'keys' ? <McpKeysScreen /> : part === 'settings' ? <SettingsPanel /> : <ImportPanel />}
    </SafeAreaView>
  );
}

function SettingsPanel() {
  const settings = useResource('mom.admin.settings', readSettings, 0);
  if (!settings.data) return <StateView loading={!settings.error} error={settings.error} onRetry={() => void settings.refresh()} testID="admin-settings" />;
  return <SettingsForm key={JSON.stringify(settings.data.transcription)} data={settings.data} refreshing={settings.loading} onRefresh={() => void settings.refresh()} />;
}

function SettingsForm({ data, refreshing, onRefresh }: { data: Settings; refreshing: boolean; onRefresh: () => void }) {
  const { t } = useTranslation();
  const action = useAdminRun('mom.admin.settings');
  const [form, setForm] = useState(data.transcription);
  const [matchAt, setMatchAt] = useState(String(data.transcription.matchAt));
  const [divergent, setDivergent] = useState(String(data.transcription.divergentBelow));
  const [prompt, setPrompt] = useState<string | null>(null);
  const [rate, setRate] = useState<string | null>(null);
  const problem = thresholdProblem(Number(matchAt), Number(divergent));
  const model = (vendor: keyof Settings['transcription']['models']) => (value: string) => setForm((current) => ({ ...current, models: { ...current.models, [vendor]: value } }));
  const test = async () => {
    const answer = await action.run('lark', testLark);
    if (answer) Alert.alert('', answer.message);
  };
  return (
    <Scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Section title={t('mom.admin.settings.keys')}>
        {data.keys.map((key) => (
          <Row key={key.id} title={key.label} detail={[key.configured ? t('mom.admin.settings.configured') : t('mom.admin.settings.missing'), key.purpose, key.where].filter(Boolean).join('\n')} />
        ))}
      </Section>
      {data.configPath ? <Text variant="footnote" tone="inkSoft">{data.configPath}</Text> : null}
      <Button kind="secondary" label={t('mom.admin.settings.testLark')} busy={action.busy === 'lark'} onPress={() => void test()} testID="settings-lark" />
      <Card>
        <Text variant="headline">{t('mom.admin.settings.transcription')}</Text>
        {vendors.map((vendor) => (
          <TextField key={vendor} label={t(`mom.admin.settings.model.${vendor}`)} hint={data.transcription.defaults[vendor]} value={form.models[vendor]} onChangeText={model(vendor)} autoCapitalize="none" autoCorrect={false} />
        ))}
        <ChoiceRow
          options={(['auto', 'preserve_source', 'speech_optimized'] as const).map((value) => ({ value, label: t(`mom.admin.settings.audio.${value}`) }))}
          value={form.audioMode}
          onChange={(audioMode) => setForm((current) => ({ ...current, audioMode }))}
          testID="settings-audio"
        />
        <Section>
          <ToggleRow title={t('mom.admin.settings.compare')} value={form.compareEnabled} onChange={(compareEnabled) => setForm((current) => ({ ...current, compareEnabled }))} />
          <ToggleRow title={t('mom.admin.settings.aiFilter')} value={form.aiFilter} onChange={(aiFilter) => setForm((current) => ({ ...current, aiFilter }))} />
        </Section>
        <TextField label={t('mom.admin.settings.matchAt')} value={matchAt} onChangeText={setMatchAt} keyboardType="decimal-pad" />
        <TextField label={t('mom.admin.settings.divergentBelow')} value={divergent} onChangeText={setDivergent} keyboardType="decimal-pad" error={problem ? t(`mom.admin.settings.threshold.${problem}`) : null} />
        <Button
          label={t('mom.followups.save')}
          disabled={!!problem}
          busy={action.busy === 'transcription'}
          onPress={() => void action.run('transcription', (account) => saveTranscription(account, { ...form, matchAt: Number(matchAt), divergentBelow: Number(divergent) }))}
          testID="settings-save-transcription"
        />
      </Card>
      {data.coworkerModel ? <Text variant="footnote" tone="inkSoft">{t('mom.admin.settings.coworkerModel', { model: data.coworkerModel })}</Text> : null}
      <Section title={t('mom.admin.settings.prompts')}>
        {data.prompts.map((one) => (
          <Row key={one.kind} title={one.label} detail={[one.custom ? t('mom.admin.settings.custom') : t('mom.admin.settings.default'), one.updatedBy, one.description].filter(Boolean).join(' · ')} onPress={() => setPrompt(one.kind)} testID={`settings-prompt-${one.kind}`} />
        ))}
      </Section>
      <Section title={t('mom.admin.settings.rates')}>
        {data.rates.map((one) => (
          <Row
            key={one.vendor}
            title={`${one.label} · ${one.model}`}
            detail={[one.perMinute === null ? t('mom.admin.settings.noRate') : `${one.symbol}${one.perMinute} / ${t('mom.admin.settings.minute')}`, one.since, one.source].filter(Boolean).join(' · ')}
            onPress={() => setRate(one.vendor)}
            testID={`settings-rate-${one.vendor}`}
          />
        ))}
      </Section>
      {prompt ? <PromptSheet data={data} kind={prompt} onClose={() => setPrompt(null)} /> : null}
      {rate ? <RateSheet data={data} vendor={rate} onClose={() => setRate(null)} /> : null}
    </Scroll>
  );
}

function PromptSheet({ data, kind, onClose }: { data: Settings; kind: string; onClose: () => void }) {
  const { t } = useTranslation();
  const action = useAdminRun('mom.admin.settings');
  const one = data.prompts.find((item) => item.kind === kind)!;
  const [text, setText] = useState(one.text);
  const [showDefault, setShowDefault] = useState(false);
  return (
    <MoreSheet
      title={one.label}
      groups={[]}
      onClose={onClose}
      footer={
        <View style={styles.block}>
          <TextField label={t('mom.admin.settings.promptText', { count: text.length, limit: one.limit })} value={text} onChangeText={setText} multiline maxLength={one.limit} testID="settings-prompt-text" />
          {showDefault ? <Text variant="footnote" selectable>{one.default}</Text> : <SmallButton label={t('mom.admin.settings.showDefault')} onPress={() => setShowDefault(true)} />}
          <Button label={t('mom.followups.save')} disabled={!text.trim() || text === one.text} busy={action.busy === 'prompt'} onPress={() => void action.run('prompt', (account) => savePrompt(account, kind, text)).then((done) => done && onClose())} testID="settings-prompt-save" />
          {one.custom ? (
            <Button kind="secondary" label={t('mom.admin.settings.reset')} busy={action.busy === 'reset'} onPress={() => void action.run('reset', (account) => resetPrompt(account, kind)).then((done) => done && onClose())} testID="settings-prompt-reset" />
          ) : null}
        </View>
      }
    />
  );
}

function RateSheet({ data, vendor, onClose }: { data: Settings; vendor: string; onClose: () => void }) {
  const { t } = useTranslation();
  const action = useAdminRun('mom.admin.settings');
  const one = data.rates.find((item) => item.vendor === vendor)!;
  const [value, setValue] = useState(one.perMinute === null ? '' : String(one.perMinute));
  const amount = Number(value.replace(',', '.'));
  return (
    <MoreSheet
      title={one.label}
      groups={[]}
      onClose={onClose}
      footer={
        <View style={styles.block}>
          <TextField label={t('mom.admin.settings.perMinute', { currency: one.currency })} value={value} onChangeText={setValue} keyboardType="decimal-pad" testID="settings-rate-value" />
          <Button label={t('mom.followups.save')} disabled={!value || !Number.isFinite(amount) || amount < 0} busy={action.busy === 'rate'} onPress={() => void action.run('rate', (account) => saveRate(account, vendor, amount)).then((done) => done && onClose())} testID="settings-rate-save" />
        </View>
      }
    />
  );
}

function ImportPanel() {
  const { t } = useTranslation();
  const overview = useResource('mom.admin.import', importOverview, 0);
  const action = useAdminRun('mom.admin.import');
  const [project, setProject] = useState<ImportProject | null>(null);
  const [run, setRun] = useState<number | null>(null);
  const data = overview.data;
  if (!data) return <StateView loading={!overview.error} error={overview.error} onRetry={() => void overview.refresh()} testID="admin-import" />;
  if (run) return <RunPanel run={run} onBack={() => setRun(null)} />;
  return (
    <Scroll refreshing={overview.loading} onRefresh={() => void overview.refresh()}>
      <Section title={t('mom.admin.import.projects', { count: data.projects.length })}>
        {data.projects.map((one) => (
          <Row
            key={one.id}
            title={[one.code, one.name].filter(Boolean).join(' · ')}
            detail={[one.decisionLabel, one.programme || one.landsIn, t('mom.admin.import.projectLine', { recordings: one.recordings, rows: one.rows }), one.decidedBy].filter(Boolean).join(' · ')}
            onPress={() => setProject(one)}
            testID={`import-project-${one.id}`}
          />
        ))}
      </Section>
      <Section title={t('mom.admin.import.runs')}>
        {data.runs.length ? (
          data.runs.map((one) => (
            <Row
              key={one.id}
              title={one.name}
              detail={[one.stateLabel, one.verdictLabel, t('mom.admin.import.runLine', { created: one.created, updated: one.updated, failed: one.failed, conflicts: one.conflicts }), one.startedAt].filter(Boolean).join(' · ')}
              onPress={() => setRun(one.id)}
              testID={`import-run-${one.id}`}
            />
          ))
        ) : (
          <Row title={t('mom.admin.import.noRuns')} />
        )}
      </Section>
      {project ? (
        <MoreSheet
          title={project.name}
          groups={[
            {
              key: 'decide',
              title: t('mom.admin.import.mapTo'),
              actions: data.programmes.map((one) => ({ key: `map-${one.id}`, icon: 'compass' as const, label: one.name, onPress: () => void action.run('map', (account) => decideProject(account, project.id, 'map', one.id)) })),
            },
            {
              key: 'other',
              actions: [
                { key: 'skip', icon: 'close' as const, label: t('mom.admin.import.skip'), onPress: () => void action.run('skip', (account) => decideProject(account, project.id, 'skip')) },
                { key: 'reopen', icon: 'retry' as const, label: t('mom.admin.import.reopen'), onPress: () => void action.run('reopen', (account) => decideProject(account, project.id, 'reopen')) },
              ],
            },
          ]}
          onClose={() => setProject(null)}
        />
      ) : null}
    </Scroll>
  );
}

function RunPanel({ run, onBack }: { run: number; onBack: () => void }) {
  const { t } = useTranslation();
  const [offset, setOffset] = useState(0);
  const detail = useResource(`mom.admin.import.run.${run}.${offset}`, (account) => runDetail(account, run, offset), 0);
  const action = useAdminRun('mom.admin.import');
  const data = detail.data;
  if (!data) return <StateView loading={!detail.error} error={detail.error} onRetry={() => void detail.refresh()} testID="import-run" />;
  const confirmRollBack = () =>
    Alert.alert(t('mom.admin.import.rollBackTitle'), data.rollbackNote || data.name, [
      { text: t('mom.recorder.cancel'), style: 'cancel' },
      { text: t('mom.admin.import.rollBack'), style: 'destructive', onPress: () => void action.run('rollBack', (account) => rollBack(account, run)).then(() => void detail.refresh()) },
    ]);
  return (
    <Scroll refreshing={detail.loading} onRefresh={() => void detail.refresh()}>
      <SmallButton label={t('mom.admin.import.back')} onPress={onBack} testID="import-run-back" />
      <Text variant="headline">{data.name}</Text>
      <Text variant="footnote" tone="inkSoft">
        {[data.stateLabel, data.verdictLabel, data.startedBy, data.startedAt, data.rolledBackAt ? t('mom.admin.import.rolledBack', { at: data.rolledBackAt }) : ''].filter(Boolean).join(' · ')}
      </Text>
      {[...data.problems, ...data.warnings].map((line) => (
        <Text key={line} variant="callout" tone="warnInk">
          {line}
        </Text>
      ))}
      {data.canRollBack ? (
        <Button kind="danger" label={t('mom.admin.import.rollBack')} busy={action.busy === 'rollBack'} onPress={confirmRollBack} testID="import-roll-back" />
      ) : data.rollbackRefusal ? (
        <Text variant="footnote" tone="inkSoft">
          {data.rollbackRefusal}
        </Text>
      ) : null}
      <Section title={t('mom.admin.import.events', { count: data.eventTotal })}>
        {data.events.map((event) => (
          <Row key={event.id} title={event.message || event.kindLabel} detail={[event.kindLabel, event.table, event.programme].filter(Boolean).join(' · ')} />
        ))}
      </Section>
      <View style={styles.row}>
        {offset > 0 ? <SmallButton label={t('mom.admin.import.previous')} onPress={() => setOffset(Math.max(0, offset - data.events.length))} /> : null}
        {offset + data.events.length < data.eventTotal ? <SmallButton label={t('mom.more')} onPress={() => setOffset(offset + data.events.length)} testID="import-run-next" /> : null}
      </View>
    </Scroll>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  block: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
});
