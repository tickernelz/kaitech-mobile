import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { space } from '../../theme';
import { Button } from '../../ui/Button';
import { Check, Row, Section } from '../../ui/List';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { Card, StateView, useErrorText } from '../discovery/ui';
import type { Edit, FinalView } from './api';
import {
  draftEmail,
  isMoment,
  localMoment,
  meetingContext,
  previewBulk,
  previewRewrite,
  regenerateNarrative,
  revokeSignoff,
  saveEmail,
  saveNarrative,
  setDistribution,
  setHeader,
  settleEdit,
  type FinalTool,
} from './final';
import { finalKey, useFinal } from './FinalPanel';
import { ChoiceRow, PickRow } from './followupParts';
import { MoreSheet } from './MoreSheet';

type Props = { tool: FinalTool; programme: number; meeting: number; section?: string; index?: number };

export function FinalToolScreen(props: Props) {
  const { t } = useTranslation();
  const final = useFinal(props.programme, props.meeting);
  const view = final.data;
  if (!view) {
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']} testID={`final-${props.tool}`}>
        <Header title={t(`mom.finalTools.${props.tool}.title`)} />
        <StateView loading={!final.error} error={final.error} onRetry={() => void final.refresh()} testID="final-tool" />
      </Screen>
    );
  }
  const tools: Record<FinalTool, ReactNode> = {
    content: <Content view={view} programme={props.programme} />,
    rewrite: <Rewrite view={view} section={props.section} index={props.index} />,
    header: <HeaderForm view={view} />,
    recipients: <Recipients view={view} />,
    email: <Email view={view} />,
    narrative: <Narrative view={view} />,
    context: <Context meeting={props.meeting} />,
    revoke: <Revoke view={view} />,
  };
  return tools[props.tool];
}

function useAct(meeting: number) {
  const { active } = useSession();
  const errorText = useErrorText();
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState('');
  const run = async <T,>(name: string, work: (account: NonNullable<typeof active>) => Promise<T>): Promise<T | undefined> => {
    if (!active || busy) return undefined;
    setBusy(name);
    setProblem('');
    try {
      const answer = await work(active);
      invalidate(`${active.id}:${finalKey(meeting)}`);
      invalidate(`${active.id}:mom.board`);
      return answer;
    } catch (error) {
      setProblem(errorText(error));
      return undefined;
    } finally {
      setBusy('');
    }
  };
  return { busy, problem, run };
}

function Frame({ tool, title, problem, footer, children }: { tool: FinalTool; title?: string; problem: string; footer?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      contentStyle={styles.body}
      testID={`final-${tool}`}
      footer={
        problem || footer ? (
          <>
            {problem ? (
              <Text variant="callout" tone="dangerInk" accessibilityRole="alert">
                {problem}
              </Text>
            ) : null}
            {footer}
          </>
        ) : undefined
      }>
      <Header title={title ?? t(`mom.finalTools.${tool}.title`)} />
      {children}
    </Screen>
  );
}

function EditCard({ edit, view, onSettled }: { edit: Edit; view: FinalView; onSettled?: () => void }) {
  const { t } = useTranslation();
  const act = useAct(view.meetingId);
  const settle = async (apply: boolean) => {
    const done = await act.run(apply ? 'apply' : 'discard', (account) => settleEdit(account, edit.id, apply));
    if (done) onSettled?.();
  };
  return (
    <Card testID={`final-edit-${edit.id}`}>
      <Text variant="footnote" tone="inkSoft">
        {[edit.modeLabel, edit.proposedBy, edit.comment].filter(Boolean).join(' · ')}
      </Text>
      {edit.lines.map((line) => (
        <View key={line.id} style={styles.line}>
          <Text variant="footnote" tone="inkSoft">
            {line.sectionLabel}
          </Text>
          <Text variant="callout" tone="inkSoft" style={styles.before}>
            {line.before}
          </Text>
          <Text variant="callout">{line.removed ? t('mom.finalTools.removed') : line.after}</Text>
        </View>
      ))}
      {edit.placeholders.length ? (
        <Text variant="footnote" tone="warnInk">
          {t('mom.finalTools.placeholders', { list: edit.placeholders.join(', ') })}
        </Text>
      ) : null}
      {act.problem ? (
        <Text variant="footnote" tone="dangerInk" accessibilityRole="alert">
          {act.problem}
        </Text>
      ) : null}
      {view.editable && edit.state === 'proposed' ? (
        <View style={styles.buttons}>
          <Button label={t('mom.finalTools.apply')} onPress={() => void settle(true)} busy={act.busy === 'apply'} style={styles.flex} testID={`final-edit-apply-${edit.id}`} />
          <Button kind="secondary" label={t('mom.finalTools.discard')} onPress={() => void settle(false)} busy={act.busy === 'discard'} style={styles.flex} testID={`final-edit-discard-${edit.id}`} />
        </View>
      ) : null}
    </Card>
  );
}

function Content({ view, programme }: { view: FinalView; programme: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const act = useAct(view.meetingId);
  const open = (section?: string, index?: number) =>
    router.push({
      pathname: '/mom/final/[tool]',
      params: { tool: 'rewrite', programme: String(programme), meeting: String(view.meetingId), ...(section ? { section, index: String(index) } : {}) },
    });
  return (
    <Frame
      tool="content"
      problem={act.problem}
      footer={view.editable ? <Button kind="secondary" label={t('mom.finalTools.bulk')} onPress={() => open()} testID="final-bulk" /> : undefined}>
      {view.editable ? (
        <Text tone="inkSoft">{t('mom.finalTools.contentHint')}</Text>
      ) : null}
      {view.edits.length ? (
        <View style={styles.block}>
          <Text variant="headline">{t('mom.finalTools.waiting')}</Text>
          {view.edits.map((edit) => (
            <EditCard key={edit.id} edit={edit} view={view} />
          ))}
        </View>
      ) : null}
      {view.outdated.length ? (
        <Section title={t('mom.finalTools.outdated')}>
          {view.outdated.map((line) => (
            <Row
              key={line.id}
              title={`${line.original_text} → ${line.new_text || t('mom.finalTools.removed')}`}
              detail={line.sectionLabel}
              onPress={view.editable ? () => void act.run('outdated', (account) => settleEdit(account, line.editId, false)) : undefined}
              trailing={view.editable ? <Text tone="link">{t('mom.finalTools.discard')}</Text> : undefined}
              testID={`final-outdated-${line.id}`}
            />
          ))}
        </Section>
      ) : null}
      {view.sections.map((section) => (
        <Section key={section.key} title={section.label}>
          {section.items.length ? (
            section.items.map((item) => (
              <Row
                key={item.index}
                title={item.removed ? t('mom.finalTools.removed') : item.text}
                detail={item.agreed ? t('mom.finalTools.agreed') : item.edited ? t('mom.finalTools.edited') : undefined}
                onPress={view.editable && !item.agreed ? () => open(section.key, item.index) : undefined}
                testID={`final-item-${section.key}-${item.index}`}
              />
            ))
          ) : (
            <Row title={t('mom.finalTools.emptySection')} />
          )}
        </Section>
      ))}
      {view.teamNotes?.length ? (
        <Section title={t('mom.finalTools.teamNotes')}>
          {view.teamNotes.map((note, index) => (
            <Row key={index} title={note.title} detail={[note.sourceOwner, note.content].filter(Boolean).join('\n')} />
          ))}
        </Section>
      ) : null}
    </Frame>
  );
}

function Rewrite({ view, section, index }: { view: FinalView; section?: string; index?: number }) {
  const { t } = useTranslation();
  const act = useAct(view.meetingId);
  const item = section === undefined ? null : view.sections.find((one) => one.key === section)?.items.find((one) => one.index === index) ?? null;
  const [mode, setMode] = useState<'ai' | 'manual'>('ai');
  const [comment, setComment] = useState('');
  const [snippet, setSnippet] = useState('');
  const [text, setText] = useState(item?.text ?? '');
  const [result, setResult] = useState<Edit | null>(null);
  const bulk = section === undefined;
  const ready = bulk || mode === 'ai' ? !!comment.trim() : text !== item?.text;
  const preview = async () => {
    const edit = await act.run('preview', (account) =>
      bulk
        ? previewBulk(account, view.meetingId, comment)
        : previewRewrite(account, view.meetingId, section!, index!, mode === 'ai' ? { comment: comment.trim(), ...(snippet.trim() ? { snippet: snippet.trim() } : {}) } : { text }),
    );
    if (edit) setResult(edit);
  };
  if (!bulk && !item) return <Frame tool="rewrite" problem=""><StateView empty={{ title: t('mom.finalTools.gone') }} /></Frame>;
  return (
    <Frame
      tool="rewrite"
      title={t(bulk ? 'mom.finalTools.bulk' : 'mom.finalTools.rewrite.title')}
      problem={act.problem}
      footer={result ? undefined : <Button label={t('mom.finalTools.preview')} onPress={() => void preview()} disabled={!ready} busy={act.busy === 'preview'} testID="final-preview" />}>
      {item ? (
        <Card>
          <Text variant="footnote" tone="inkSoft">
            {view.sections.find((one) => one.key === section)?.label}
          </Text>
          <Text>{item.text}</Text>
        </Card>
      ) : (
        <Text tone="inkSoft">{t('mom.finalTools.bulkHint')}</Text>
      )}
      {result ? (
        result.lines.length ? (
          <EditCard edit={result} view={view} onSettled={() => setResult(null)} />
        ) : (
          <Text>{result.message ?? t('mom.finalTools.nothing')}</Text>
        )
      ) : (
        <>
          {bulk ? null : (
            <ChoiceRow
              options={[
                { value: 'ai' as const, label: t('mom.finalTools.ai') },
                { value: 'manual' as const, label: t('mom.finalTools.manual') },
              ]}
              value={mode}
              onChange={setMode}
              testID="final-mode"
            />
          )}
          {bulk || mode === 'ai' ? (
            <>
              <TextField label={t(bulk ? 'mom.finalTools.guidance' : 'mom.finalTools.comment')} value={comment} onChangeText={setComment} multiline testID="final-comment" />
              {bulk ? null : <TextField label={t('mom.finalTools.snippet')} hint={t('mom.finalTools.snippetHint')} value={snippet} onChangeText={setSnippet} multiline testID="final-snippet" />}
            </>
          ) : (
            <TextField label={t('mom.finalTools.text')} hint={t('mom.finalTools.textHint')} value={text} onChangeText={setText} multiline testID="final-text" />
          )}
        </>
      )}
    </Frame>
  );
}

function HeaderForm({ view }: { view: FinalView }) {
  const { t } = useTranslation();
  const router = useRouter();
  const act = useAct(view.meetingId);
  const [date, setDate] = useState(localMoment(view.header.meetingDate, view.paper.zone));
  const [location, setLocation] = useState(view.header.location);
  const [topic, setTopic] = useState(view.header.topic);
  const [noteTaker, setNoteTaker] = useState<number | null>(view.header.noteTakerProfileId || null);
  const [attendees, setAttendees] = useState(view.header.attendees.map((one) => one.profileId));
  const [picking, setPicking] = useState(false);
  const locked = !view.editable;
  const wrong = !!date && !isMoment(date);
  const save = async () => {
    const done = await act.run('save', (account) => setHeader(account, view.documentId, { meetingDate: date.trim(), location, topic, noteTaker, attendees }));
    if (done) router.back();
  };
  const toggle = (id: number) => setAttendees((list) => (list.includes(id) ? list.filter((one) => one !== id) : [...list, id]));
  return (
    <Frame
      tool="header"
      problem={act.problem}
      footer={locked ? undefined : <Button label={t('mom.followups.save')} onPress={() => void save()} disabled={wrong} busy={act.busy === 'save'} testID="final-header-save" />}>
      {locked ? <Text tone="inkSoft">{t('mom.finalTools.lockedDraft')}</Text> : null}
      <TextField label={t('mom.finalTools.header.date')} hint={t('mom.finalTools.header.dateHint')} value={date} onChangeText={setDate} editable={!locked} error={wrong ? t('mom.finalTools.header.dateWrong') : null} testID="final-header-date" />
      <TextField label={t('mom.finalTools.header.location')} value={location} onChangeText={setLocation} editable={!locked} testID="final-header-location" />
      <TextField label={t('mom.finalTools.header.topic')} value={topic} onChangeText={setTopic} editable={!locked} multiline testID="final-header-topic" />
      <PickRow
        label={t('mom.finalTools.header.noteTaker')}
        value={view.profiles.find((one) => one.profileId === noteTaker)?.name ?? ''}
        placeholder={t('mom.setup.choose')}
        onPress={() => (locked ? undefined : setPicking(true))}
        testID="final-header-note-taker"
      />
      <Section title={t('mom.finalTools.header.attendees', { count: attendees.length })}>
        {view.profiles.map((profile) => (
          <Row
            key={profile.profileId}
            title={profile.name}
            detail={[profile.role, profile.organization].filter(Boolean).join(' · ')}
            selected={attendees.includes(profile.profileId)}
            trailing={<Check visible={attendees.includes(profile.profileId)} />}
            onPress={locked ? undefined : () => toggle(profile.profileId)}
            testID={`final-attendee-${profile.profileId}`}
          />
        ))}
      </Section>
      {picking ? (
        <MoreSheet
          title={t('mom.finalTools.header.noteTaker')}
          groups={[{ key: 'people', actions: view.profiles.map((one) => ({ key: `taker-${one.profileId}`, icon: 'people' as const, label: one.name, detail: one.organization, onPress: () => setNoteTaker(one.profileId) })) }]}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </Frame>
  );
}

function Recipients({ view }: { view: FinalView }) {
  const { t } = useTranslation();
  const router = useRouter();
  const act = useAct(view.meetingId);
  const [chosen, setChosen] = useState(view.distribution.map((one) => one.profileId));
  const locked = !view.canChange || view.state === 'final' || view.state === 'distributed';
  const sent = new Map(view.distribution.map((one) => [one.profileId, one]));
  const toggle = (id: number) => setChosen((list) => (list.includes(id) ? list.filter((one) => one !== id) : [...list, id]));
  const save = async () => {
    const done = await act.run('save', (account) => setDistribution(account, view.documentId, chosen));
    if (done) router.back();
  };
  const people = locked ? view.distribution.map((one) => ({ profileId: one.profileId, name: one.name, role: one.role, organization: one.organization })) : view.profiles;
  return (
    <Frame
      tool="recipients"
      problem={act.problem}
      footer={locked ? undefined : <Button label={t('mom.followups.save')} onPress={() => void save()} busy={act.busy === 'save'} testID="final-recipients-save" />}>
      <Text tone="inkSoft">{t(locked ? 'mom.finalTools.recipientsLocked' : view.distributionIsDefault ? 'mom.finalTools.recipientsDefault' : 'mom.finalTools.recipientsHint')}</Text>
      <Section>
        {people.map((profile) => {
          const line = sent.get(profile.profileId);
          const state = line ? (line.sentAt ? t('mom.finalTools.sentTo', { address: line.address }) : line.mailFailure || line.address || t('mom.finalTools.noAddress')) : '';
          return (
            <Row
              key={profile.profileId}
              title={profile.name}
              detail={[[profile.role, profile.organization].filter(Boolean).join(' · '), state].filter(Boolean).join('\n')}
              selected={locked ? undefined : chosen.includes(profile.profileId)}
              trailing={locked ? undefined : <Check visible={chosen.includes(profile.profileId)} />}
              onPress={locked ? undefined : () => toggle(profile.profileId)}
              testID={`final-recipient-${profile.profileId}`}
            />
          );
        })}
      </Section>
    </Frame>
  );
}

function Email({ view }: { view: FinalView }) {
  const { t } = useTranslation();
  const router = useRouter();
  const act = useAct(view.meetingId);
  const [subject, setSubject] = useState(view.email.subject);
  const [body, setBody] = useState(view.email.body);
  const [note, setNote] = useState(view.email.note);
  const locked = !view.canChange || view.state === 'distributed';
  const draft = async () => {
    const drafted = await act.run('draft', (account) => draftEmail(account, view.meetingId, note));
    if (drafted) {
      setSubject(drafted.subject);
      setBody(drafted.body);
    }
  };
  const save = async () => {
    const done = await act.run('save', (account) => saveEmail(account, view.documentId, subject, body));
    if (done) router.back();
  };
  return (
    <Frame
      tool="email"
      problem={act.problem}
      footer={
        locked ? undefined : (
          <Button label={t('mom.followups.save')} onPress={() => void save()} disabled={!subject.trim() || !body.trim()} busy={act.busy === 'save'} testID="final-email-save" />
        )
      }>
      {view.email.problems.map((line) => (
        <Text key={line} variant="callout" tone="warnInk">
          {line}
        </Text>
      ))}
      {locked ? null : (
        <Card>
          <TextField label={t('mom.finalTools.emailNote')} value={note} onChangeText={setNote} multiline testID="final-email-note" />
          <Button kind="secondary" label={t('mom.finalTools.draftEmail')} onPress={() => void draft()} busy={act.busy === 'draft'} testID="final-email-draft" />
        </Card>
      )}
      <TextField label={t('mom.finalTools.subject')} value={subject} onChangeText={setSubject} editable={!locked} testID="final-email-subject" />
      <TextField label={t('mom.finalTools.emailBody')} value={body} onChangeText={setBody} editable={!locked} multiline testID="final-email-body" />
    </Frame>
  );
}

function Narrative({ view }: { view: FinalView }) {
  const { t } = useTranslation();
  const router = useRouter();
  const act = useAct(view.meetingId);
  const [text, setText] = useState(view.narrative.text);
  const locked = !view.editable;
  const regenerate = async () => {
    const answer = await act.run('regenerate', (account) => regenerateNarrative(account, view.meetingId));
    if (answer) setText(answer.narrative);
  };
  const save = async () => {
    const done = await act.run('save', (account) => saveNarrative(account, view.documentId, text));
    if (done) router.back();
  };
  return (
    <Frame
      tool="narrative"
      problem={act.problem}
      footer={
        locked ? undefined : (
          <View style={styles.buttons}>
            <Button kind="secondary" label={t('mom.finalTools.regenerate')} onPress={() => void regenerate()} busy={act.busy === 'regenerate'} style={styles.flex} testID="final-narrative-regenerate" />
            <Button label={t('mom.followups.save')} onPress={() => void save()} busy={act.busy === 'save'} style={styles.flex} testID="final-narrative-save" />
          </View>
        )
      }>
      {locked ? <Text tone="inkSoft">{t('mom.finalTools.lockedDraft')}</Text> : null}
      <TextField label={t('mom.finalTools.narrative.title')} value={text} onChangeText={setText} editable={!locked} multiline testID="final-narrative-text" />
    </Frame>
  );
}

function Context({ meeting }: { meeting: number }) {
  const { t } = useTranslation();
  const context = useResource(`mom.context.${meeting}`, (account) => meetingContext(account, meeting));
  const data = context.data;
  const groups = data
    ? ([
        ['openActions', data.openActions],
        ['carriedActions', data.carriedActions],
        ['openQuestions', data.openQuestions],
        ['pendingDecisions', data.pendingDecisions],
        ['approvedDecisions', data.approvedDecisions],
        ['recentNotes', data.recentNotes],
        ['previousMeetings', data.previousMeetings],
      ] as const)
    : [];
  return (
    <Frame tool="context" problem="">
      {data ? (
        <>
          {data.prerequisites ? <Card><Text>{data.prerequisites}</Text></Card> : null}
          {groups.map(([key, rows]) => (
            <Section key={key} title={t(`mom.finalTools.context.${key}`, { count: key in data.counts ? data.counts[key as keyof typeof data.counts] : rows.length })}>
              {rows.length ? (
                rows.map((row) => <Row key={row.id} title={row.code ? `${row.code} · ${row.title}` : row.title} detail={[row.owner, row.meeting, row.due, row.status].filter(Boolean).join(' · ') || undefined} />)
              ) : (
                <Row title={t('mom.finalTools.context.none')} />
              )}
            </Section>
          ))}
        </>
      ) : (
        <StateView loading={!context.error} error={context.error} onRetry={() => void context.refresh()} testID="final-context" />
      )}
    </Frame>
  );
}

function Revoke({ view }: { view: FinalView }) {
  const { t } = useTranslation();
  const router = useRouter();
  const act = useAct(view.meetingId);
  const [reason, setReason] = useState('');
  const revoke = async () => {
    const done = await act.run('revoke', (account) => revokeSignoff(account, view.documentId, reason));
    if (done) router.back();
  };
  return (
    <Frame
      tool="revoke"
      problem={act.problem}
      footer={<Button kind="danger" label={t('mom.finalTools.revoke.confirm')} onPress={() => void revoke()} disabled={!reason.trim()} busy={act.busy === 'revoke'} testID="final-revoke-confirm" />}>
      <Text>{t('mom.finalTools.revoke.body')}</Text>
      {view.revokeReasons ? (
        <Text variant="footnote" tone="inkSoft">
          {view.revokeReasons}
        </Text>
      ) : null}
      <TextField label={t('mom.finalTools.revoke.reason')} value={reason} onChangeText={setReason} multiline testID="final-revoke-reason" />
    </Frame>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
  block: { gap: space.md },
  line: { gap: 2 },
  before: { textDecorationLine: 'line-through' },
  buttons: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
});
