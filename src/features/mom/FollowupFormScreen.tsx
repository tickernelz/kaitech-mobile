import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { space } from '../../theme';
import { Button } from '../../ui/Button';
import { Screen } from '../../ui/Screen';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { useCurrentProgramme } from '../discovery/Home';
import { Header } from '../discovery/Header';
import { StateView, useErrorText } from '../discovery/ui';
import { DueField, PickRow, UrgencyChoice } from './followupParts';
import { followupBoard, followupItem, isDay, raiseFollowup, saveDetails, type FollowupItem, type Urgency } from './followups';
import { MoreSheet } from './MoreSheet';

type Picking = 'owner' | 'meeting' | null;

export function FollowupFormScreen({ id }: { id: number | null }) {
  const { t } = useTranslation();
  const { current } = useCurrentProgramme();
  const programme = current?.id ?? 0;
  const choices = useResource(programme ? `mom.followups.choices.${programme}` : null, (account) =>
    followupBoard(account, { programme, status: 'all', owner: 0, meeting: 0, search: '', limit: 1 }),
  );
  const item = useResource(id ? `mom.followup.${id}` : null, (account) => followupItem(account, id!));
  if (!choices.data || (id && !item.data)) {
    const error = choices.error ?? item.error;
    return (
      <Screen edges={['top', 'bottom', 'left', 'right']} testID="mom-followup-form">
        <Header title={t(id ? 'mom.followups.edit' : 'mom.followups.add')} />
        <StateView loading={!error} error={error} onRetry={() => void (choices.error ? choices.refresh() : item.refresh())} testID="followup-form" />
      </Screen>
    );
  }
  return <Form key={id ?? 'new'} item={id ? item.data! : null} owners={choices.data.owners} meetings={choices.data.meetingChoices} />;
}

function Form({ item, owners, meetings }: { item: FollowupItem | null; owners: { id: number; name: string }[]; meetings: { id: number; name: string; date: string }[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const { active } = useSession();
  const [name, setName] = useState('');
  const [meeting, setMeeting] = useState(0);
  const [owner, setOwner] = useState<number | null>(item?.owner ? item.owner.id : null);
  const [deadline, setDeadline] = useState(item?.deadline ?? '');
  const [urgency, setUrgency] = useState<Urgency | ''>(item?.urgency ?? '');
  const [topic, setTopic] = useState(item?.topic ?? '');
  const [detail, setDetail] = useState(item?.detail ?? '');
  const [picking, setPicking] = useState<Picking>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const ownerName = owners.find((one) => one.id === owner)?.name ?? '';
  const meetingName = meetings.find((one) => one.id === meeting)?.name ?? '';
  const dayOk = !deadline || isDay(deadline);
  const ready = item ? dayOk : !!name.trim() && !!meeting && !!owner && !!deadline && dayOk;

  const save = async () => {
    if (!active || !ready || busy) return;
    setBusy(true);
    setProblem('');
    try {
      if (item) {
        await saveDetails(active, item, { owner, deadline, urgency, topic: topic.trim(), detail: detail.trim() });
        invalidate(`${active.id}:mom.followup`);
        router.back();
      } else {
        const created = await raiseFollowup(active, { meeting, name, owner: owner!, deadline, urgency, detail });
        invalidate(`${active.id}:mom.followup`);
        router.replace({ pathname: '/mom/followup/[id]', params: { id: String(created) } });
      }
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      scroll
      edges={['top', 'bottom', 'left', 'right']}
      contentStyle={styles.body}
      testID="mom-followup-form"
      footer={
        <>
          {problem ? (
            <Text variant="callout" tone="dangerInk" accessibilityRole="alert">
              {problem}
            </Text>
          ) : null}
          <Button label={t('mom.followups.save')} onPress={() => void save()} disabled={!ready} busy={busy} testID="followup-save" />
        </>
      }>
      <Header title={item ? item.name : t('mom.followups.add')} subtitle={item ? t('mom.followups.edit') : undefined} />
      {item ? null : (
        <>
          <PickRow label={t('mom.followups.meeting')} value={meetingName} placeholder={t('mom.setup.choose')} onPress={() => setPicking('meeting')} testID="followup-meeting" />
          <TextField label={t('mom.followups.name')} value={name} onChangeText={setName} multiline testID="followup-name-field" />
        </>
      )}
      <PickRow label={t('mom.followups.owner')} value={ownerName} placeholder={t('mom.setup.choose')} onPress={() => setPicking('owner')} testID="followup-owner" />
      <DueField value={deadline} onChange={setDeadline} />
      <UrgencyChoice value={urgency} onChange={setUrgency} />
      {item ? <TextField label={t('mom.followups.topic')} value={topic} onChangeText={setTopic} testID="followup-topic" /> : null}
      <TextField label={t('mom.followups.detail')} value={detail} onChangeText={setDetail} multiline testID="followup-detail" />
      {picking ? (
        <MoreSheet
          title={t(picking === 'owner' ? 'mom.followups.owner' : 'mom.followups.meeting')}
          groups={[
            {
              key: picking,
              actions:
                picking === 'owner'
                  ? owners.map((one) => ({ key: `owner-${one.id}`, icon: 'people' as const, label: one.name, onPress: () => setOwner(one.id) }))
                  : meetings.map((one) => ({ key: `meeting-${one.id}`, icon: 'meeting' as const, label: one.name, detail: one.date, onPress: () => setMeeting(one.id) })),
            },
          ]}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.lg },
});
