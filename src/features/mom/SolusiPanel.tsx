import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { localFile } from '../chat/files';
import { useVoiceHold } from '../chat/ui/useVoiceHold';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Card, Chip, StateView } from '../discovery/ui';
import {
  draftOf,
  isLive,
  reuseCandidates,
  saveItem,
  solusiCall,
  solusiOverview,
  solusiVersion,
  touchpointConflicts,
  type ItemDraft,
  type Related,
  type SolusiItem,
  type SolusiOverview,
} from './assist';
import { assistKey, Scroll, useAssistRun, usePoll } from './assistParts';
import { ChoiceRow } from './followupParts';
import { MoreSheet, type MoreAction } from './MoreSheet';
import { SmallButton } from './parts';

const approaches = ['ODOO_STANDARD', 'ODOO_CUSTOM', 'NON_ODOO'] as const;
const efforts = ['LOW', 'MEDIUM', 'HIGH'] as const;

function VoiceButton({ label, onVoice, testID }: { label: string; onVoice: (data: string, mimetype: string) => void; testID: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const voice = useVoiceHold((recorded) => {
    void localFile(recorded.uri)
      .base64()
      .then((data) => onVoice(data, recorded.mimetype));
  });
  return (
    <View
      {...voice.hold}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t('mom.assist.solusi.holdHint')}
      style={[styles.voice, { borderColor: colors.line, backgroundColor: voice.recording ? colors.select : colors.surface }]}
      testID={testID}>
      <Text variant="callout" tone={voice.recording ? 'selectInk' : 'ink'}>
        {voice.recording ? t('mom.assist.solusi.listening', { seconds: Math.round(voice.recording.elapsed / 1000) }) : label}
      </Text>
    </View>
  );
}

export function SolusiPanel({ meeting }: { meeting: number }) {
  const { t } = useTranslation();
  const overview = useResource(assistKey('solusi', meeting), (account) => solusiOverview(account, meeting), 0);
  const data = overview.data;
  const live = isLive(data?.job) || (data?.current ? !!data.current.items?.some((item) => isLive(item.job)) : false);
  usePoll(live, overview.refresh);
  const action = useAssistRun('solusi', meeting);
  const [instruction, setInstruction] = useState('');
  const [chosen, setChosen] = useState<SolusiItem | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  if (!data) return <StateView loading={!overview.error} error={overview.error} onRetry={() => void overview.refresh()} testID="assist-solusi" />;
  const current = data.current;
  const editable = data.canChange && !live;
  return (
    <>
      <Scroll refreshing={overview.loading} onRefresh={() => void overview.refresh()}>
        {data.job && (data.job.label || data.job.message) ? (
          <Text variant="footnote" tone="inkSoft" accessibilityRole="alert">
            {[data.job.kindLabel, data.job.label, data.job.message].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
        {current ? (
          <Card testID="solusi-current">
            <Text variant="headline">{t('mom.assist.solusi.version', { version: current.version, approved: current.approvedCount, count: current.itemCount })}</Text>
            <Text variant="footnote" tone="inkSoft">
              {[current.originLabel, current.by, current.at, current.model].filter(Boolean).join(' · ')}
            </Text>
            {current.overall ? <Text>{current.overall}</Text> : null}
          </Card>
        ) : (
          <Text tone="inkSoft">{t(data.generated ? 'mom.assist.solusi.none' : 'mom.assist.solusi.needsMinutes')}</Text>
        )}
        {editable ? (
          <Button
            kind={current ? 'secondary' : 'primary'}
            label={t(current ? 'mom.assist.solusi.again' : 'mom.assist.solusi.generate')}
            disabled={!data.generated}
            onPress={() => void action.run('generate', (account) => solusiCall(account, 'generate_solusi', meeting))}
            busy={action.busy === 'generate'}
            testID="solusi-generate"
          />
        ) : null}
        {(current ? (current.items ?? []) : []).map((item) => (
          <Row
            key={item.id}
            title={`${item.sequence}. ${item.title}`}
            detail={[item.need, t(`mom.assist.solusi.approach.${item.approach}` as never, { defaultValue: item.approach }) as string, item.approved ? t('mom.assist.solusi.approved') : '', isLive(item.job) && item.job ? item.job.label : '']
              .filter(Boolean)
              .join(' · ')}
            onPress={() => setChosen(item)}
            testID={`solusi-item-${item.id}`}
          />
        ))}
        {editable && current ? (
          <Card>
            <TextField label={t('mom.assist.solusi.instruction')} value={instruction} onChangeText={setInstruction} multiline testID="solusi-instruction" />
            <Button
              kind="secondary"
              label={t('mom.assist.solusi.applyInstruction')}
              disabled={!instruction.trim()}
              busy={action.busy === 'edit'}
              onPress={() => void action.run('edit', (account) => solusiCall(account, 'edit_solusi', meeting, instruction.trim())).then((ok) => ok && setInstruction(''))}
              testID="solusi-edit"
            />
            <VoiceButton label={t('mom.assist.solusi.voice')} onVoice={(voice, mimetype) => void action.run('voice', (account) => solusiCall(account, 'edit_solusi_by_voice', meeting, voice, mimetype))} testID="solusi-voice" />
          </Card>
        ) : null}
        {data.versions.length > 1 ? (
          <Section title={t('mom.assist.solusi.versions')}>
            {data.versions.map((one) => (
              <Row
                key={one.id}
                title={t('mom.assist.solusi.versionShort', { version: one.version })}
                detail={[one.current ? t('mom.assist.solusi.currentVersion') : '', one.originLabel, one.at].filter(Boolean).join(' · ')}
                onPress={one.current ? undefined : () => setVersion(one.id)}
                testID={`solusi-version-${one.id}`}
              />
            ))}
          </Section>
        ) : null}
      </Scroll>
      {chosen ? <ItemSheet item={current && current.items ? (current.items.find((one) => one.id === chosen.id) ?? chosen) : chosen} data={data} meeting={meeting} older={false} onClose={() => setChosen(null)} /> : null}
      {version ? <VersionSheet solusi={version} data={data} meeting={meeting} onClose={() => setVersion(null)} /> : null}
    </>
  );
}

function Sheet({ onClose, children, testID }: { onClose: () => void; children: ReactNode; testID: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={[styles.scrim, { backgroundColor: colors.scrim }]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('mom.menu.close')}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, space.lg) }]} onPress={() => undefined} accessibilityViewIsModal testID={testID}>
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function VersionSheet({ solusi, data, meeting, onClose }: { solusi: number; data: SolusiOverview; meeting: number; onClose: () => void }) {
  const { t } = useTranslation();
  const view = useResource(`mom.solusi.version.${solusi}`, (account) => solusiVersion(account, solusi));
  const action = useAssistRun('solusi', meeting);
  const [item, setItem] = useState<SolusiItem | null>(null);
  if (item) return <ItemSheet item={item} data={data} meeting={meeting} older onClose={() => setItem(null)} />;
  return (
    <Sheet onClose={onClose} testID="solusi-version-sheet">
      {view.data ? (
        <>
          <Text variant="headline">{t('mom.assist.solusi.versionShort', { version: view.data.version })}</Text>
          {view.data.overall ? <Text>{view.data.overall}</Text> : null}
          {view.data.items?.map((one) => <Row key={one.id} title={`${one.sequence}. ${one.title}`} detail={one.need} onPress={() => setItem(one)} />)}
          {data.canChange ? (
            <Button
              kind="secondary"
              label={t('mom.assist.solusi.restore')}
              busy={action.busy === 'restore'}
              onPress={() => void action.run('restore', (account) => solusiCall(account, 'restore_solusi_version', solusi)).then((ok) => ok && onClose())}
              testID="solusi-restore"
            />
          ) : null}
        </>
      ) : (
        <StateView loading={!view.error} error={view.error} onRetry={() => void view.refresh()} />
      )}
    </Sheet>
  );
}

type ItemPage = 'view' | 'instruct' | 'edit' | 'reuse' | 'conflicts';

function ItemSheet({ item, data, meeting, older, onClose }: { item: SolusiItem; data: SolusiOverview; meeting: number; older: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const action = useAssistRun('solusi', meeting);
  const [page, setPage] = useState<ItemPage>('view');
  const [instruction, setInstruction] = useState('');
  const [draft, setDraft] = useState<ItemDraft>(() => draftOf(item));
  const [related, setRelated] = useState<{ title: string; rows: Related[]; reuse: boolean } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const editable = data.canChange && !isLive(item.job) && !isLive(data.job);
  const done = (ok: boolean) => ok && onClose();
  const approve = () => {
    const run = () => void action.run('approve', (account) => solusiCall(account, 'approve_solusi_item', item.id, true)).then(done);
    if (data.pendingDecisions.length) {
      Alert.alert(t('mom.assist.solusi.pendingTitle'), data.pendingDecisions.join('\n'), [
        { text: t('mom.recorder.cancel'), style: 'cancel' },
        { text: t('mom.assist.solusi.approve'), onPress: run },
      ]);
    } else run();
  };
  const load = async (kind: 'reuse' | 'conflicts') => {
    await action.run(kind, async (account) => {
      if (kind === 'reuse') {
        const answer = await reuseCandidates(account, item.id);
        setRelated({ title: t('mom.assist.solusi.reuseTitle'), rows: answer.candidates, reuse: true });
      } else {
        const answer = await touchpointConflicts(account, item.id);
        setRelated({ title: t('mom.assist.solusi.conflictsTitle', { tag: answer.tag }), rows: [...answer.conflicts, ...answer.aligned], reuse: false });
      }
    });
    setPage(kind);
  };
  const more: MoreAction[] = editable
    ? older
      ? [{ key: 'pick', icon: 'download', label: t('mom.assist.solusi.cherryPick'), onPress: () => void action.run('pick', (account) => solusiCall(account, 'cherry_pick_solusi_item', item.id)).then(done) }]
      : [
          { key: 'instruct', icon: 'sparkle', label: t('mom.assist.solusi.instruct'), onPress: () => setPage('instruct') },
          { key: 'edit', icon: 'doc', label: t('mom.assist.solusi.editItem'), onPress: () => setPage('edit') },
          { key: 'scope', icon: 'compass', label: t('mom.assist.solusi.assess'), onPress: () => void action.run('scope', (account) => solusiCall(account, 'assess_solusi_scope', item.id)) },
          { key: 'reuse', icon: 'history', label: t('mom.assist.solusi.reuse'), onPress: () => void load('reuse') },
          ...(item.touchpointTag ? [{ key: 'conflicts', icon: 'alert' as const, label: t('mom.assist.solusi.conflicts'), onPress: () => void load('conflicts') }] : []),
          ...(item.approved ? [{ key: 'return', icon: 'retry' as const, label: t('mom.assist.solusi.return'), onPress: () => void action.run('return', (account) => solusiCall(account, 'return_solusi_item', item.id)).then(done) }] : []),
        ]
    : [];
  const set = (key: keyof ItemDraft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <Sheet onClose={onClose} testID="solusi-item-sheet">
      <Text variant="headline">{`${item.sequence}. ${item.title}`}</Text>
      <View style={styles.row}>
        <Chip label={t(`mom.assist.solusi.approach.${item.approach}` as never, { defaultValue: item.approach }) as string} tone="select" />
        {item.effort ? <Chip label={t(`mom.assist.solusi.effort.${item.effort}` as never, { defaultValue: item.effort }) as string} /> : null}
        {item.approved ? <Chip label={t('mom.assist.solusi.approved')} tone="ok" /> : null}
      </View>
      {page === 'view' ? (
        <>
          <Text>{item.need}</Text>
          {item.requirement ? <Text variant="footnote" tone="inkSoft">{`${item.requirement.ref} ${item.requirement.text}`}</Text> : null}
          {item.odooModules.length ? <Text variant="callout">{t('mom.assist.solusi.modules', { list: item.odooModules.join(', ') })}</Text> : null}
          {item.steps.map((step, index) => (
            <Text key={index} variant="callout">{`${index + 1}. ${step}`}</Text>
          ))}
          {item.selectionReason ? <Text variant="footnote" tone="inkSoft">{item.selectionReason}</Text> : null}
          {item.customWithoutReason ? <Text variant="footnote" tone="warnInk">{t('mom.assist.solusi.customWithoutReason')}</Text> : null}
          {item.notes ? <Text variant="footnote">{item.notes}</Text> : null}
          {item.scope ? <Text variant="footnote" tone="inkSoft">{[item.scope.label, item.scope.rationale].filter(Boolean).join(' · ')}</Text> : null}
          {item.job && (isLive(item.job) || item.job.state === 'failed') ? <Text variant="footnote" tone="inkSoft">{[item.job.label, item.job.message].filter(Boolean).join(' · ')}</Text> : null}
          <Text variant="footnote" tone="inkSoft">{[item.draftedBy === 'coworker' ? t('mom.assist.coworker') : '', item.reusedFrom].filter(Boolean).join(' · ')}</Text>
          {editable && !older && data.canApprove && !item.approved ? <Button label={t('mom.assist.solusi.approve')} onPress={approve} busy={action.busy === 'approve'} testID="solusi-approve" /> : null}
          {more.length ? <SmallButton label={t('mom.menu.title')} onPress={() => setMoreOpen(true)} testID="solusi-item-more" /> : null}
        </>
      ) : null}
      {page === 'instruct' ? (
        <>
          <TextField label={t('mom.assist.solusi.instruction')} value={instruction} onChangeText={setInstruction} multiline autoFocus testID="solusi-item-instruction" />
          <Button
            label={t('mom.assist.solusi.applyInstruction')}
            disabled={!instruction.trim()}
            busy={action.busy === 'instruct'}
            onPress={() => void action.run('instruct', (account) => solusiCall(account, 'edit_solusi_item', item.id, instruction.trim())).then(done)}
            testID="solusi-item-instruct"
          />
          <VoiceButton label={t('mom.assist.solusi.voice')} onVoice={(voice, mimetype) => void action.run('voice', (account) => solusiCall(account, 'edit_solusi_item_by_voice', item.id, voice, mimetype)).then(done)} testID="solusi-item-voice" />
        </>
      ) : null}
      {page === 'edit' ? (
        <>
          <TextField label={t('mom.assist.solusi.fields.title')} value={draft.title} onChangeText={set('title')} testID="solusi-field-title" />
          <TextField label={t('mom.assist.solusi.fields.need')} value={draft.need} onChangeText={set('need')} multiline />
          <ChoiceRow options={approaches.map((value) => ({ value, label: t(`mom.assist.solusi.approach.${value}`) }))} value={draft.approach as (typeof approaches)[number]} onChange={set('approach')} testID="solusi-field-approach" />
          <TextField label={t('mom.assist.solusi.fields.modules')} value={draft.modules} onChangeText={set('modules')} autoCapitalize="none" />
          <TextField label={t('mom.assist.solusi.fields.steps')} value={draft.steps} onChangeText={set('steps')} multiline />
          <ChoiceRow options={efforts.map((value) => ({ value, label: t(`mom.assist.solusi.effort.${value}`) }))} value={draft.effort as (typeof efforts)[number]} onChange={set('effort')} testID="solusi-field-effort" />
          <TextField label={t('mom.assist.solusi.fields.reason')} value={draft.reason} onChangeText={set('reason')} multiline />
          <TextField label={t('mom.assist.solusi.fields.notes')} value={draft.notes} onChangeText={set('notes')} multiline />
          <TextField label={t('mom.assist.solusi.fields.touchpoint')} value={draft.touchpoint} onChangeText={set('touchpoint')} autoCapitalize="none" />
          {data.requirements.length ? (
            <ChoiceRow
              options={[{ value: 0, label: t('mom.assist.solusi.noRequirement') }, ...data.requirements.map((one) => ({ value: one.id, label: one.ref || one.text }))]}
              value={draft.requirement || 0}
              onChange={(value) => setDraft((current) => ({ ...current, requirement: value || false }))}
              testID="solusi-field-requirement"
            />
          ) : null}
          <Button label={t('mom.followups.save')} disabled={!draft.title.trim()} busy={action.busy === 'save'} onPress={() => void action.run('save', (account) => saveItem(account, item.id, draft)).then(done)} testID="solusi-item-save" />
        </>
      ) : null}
      {(page === 'reuse' || page === 'conflicts') && related ? (
        <>
          <Text variant="callout" style={styles.strong}>
            {related.title}
          </Text>
          {related.rows.length ? (
            related.rows.map((one) => (
              <Card key={`${one.id}-${one.meeting}`}>
                <Text variant="callout" style={styles.strong}>
                  {one.title}
                </Text>
                <Text variant="footnote" tone="inkSoft">
                  {[one.meeting, one.department, one.why].filter(Boolean).join(' · ')}
                </Text>
                {related.reuse && editable ? (
                  <SmallButton label={t('mom.assist.solusi.useThis')} onPress={() => void action.run('reuseOne', (account) => solusiCall(account, 'reuse_solusi', item.id, one.id)).then(done)} testID={`solusi-reuse-${one.id}`} />
                ) : null}
              </Card>
            ))
          ) : (
            <Text tone="inkSoft">{t('mom.assist.solusi.nothingRelated')}</Text>
          )}
        </>
      ) : null}
      {page !== 'view' ? <SmallButton label={t('mom.assist.solusi.backToItem')} onPress={() => setPage('view')} testID="solusi-item-back" /> : null}
      {moreOpen ? <MoreSheet title={t('mom.menu.title')} groups={[{ key: 'item', actions: more }]} onClose={() => setMoreOpen(false)} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  strong: { fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  voice: { minHeight: 48, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  scrim: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '90%', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingTop: space.lg, paddingHorizontal: space.lg },
  sheetBody: { gap: space.sm, paddingBottom: space.sm },
});
