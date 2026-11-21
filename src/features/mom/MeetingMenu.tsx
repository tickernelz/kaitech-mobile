import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { invalidate, useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { IconButton } from '../../ui/IconButton';
import { useErrorText } from '../discovery/ui';
import { MoreSheet, type MoreGroup } from './MoreSheet';
import { verbActions, type RecordingVerb } from './recordingActions';
import { compareWithElevenLabs, meetingRecordings, transcribe, type RecordingCard } from './records';

export function MeetingMenu({ meeting }: { meeting: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const errorText = useErrorText();
  const { active } = useSession();
  const [open, setOpen] = useState(false);
  const board = useResource(`mom.recordings.${meeting}`, (account) => meetingRecordings(account, meeting));
  const cards = board.data?.recordings ?? [];

  const start = async (verb: RecordingVerb, card: RecordingCard) => {
    if (!active) return;
    try {
      await (verb === 'compare' ? compareWithElevenLabs(active, card.id) : transcribe(active, card.id));
      invalidate(`${active.id}:mom.`);
      Alert.alert('', t(`mom.recordingMenu.started.${verb === 'compare' ? 'compare' : 'transcribe'}`, { title: card.name }));
    } catch (error) {
      Alert.alert('', errorText(error));
    }
  };

  const run = (verb: RecordingVerb, card: RecordingCard) => {
    if (verb === 'remove') {
      router.push({ pathname: '/mom/remove', params: { recording: String(card.id), meeting: String(meeting) } });
      return;
    }
    Alert.alert(t(`mom.recordingMenu.confirm.${verb}`), card.name, [
      { text: t('mom.recorder.cancel'), style: 'cancel' },
      { text: t(`mom.recordingMenu.${verb}`), onPress: () => void start(verb, card) },
    ]);
  };

  const groups: MoreGroup[] = board.data
    ? cards.map((card) => ({
        key: String(card.id),
        title: cards.length > 1 ? t('mom.recordingMenu.group', { title: card.name }) : t('mom.recordingMenu.groupOne'),
        actions: verbActions(card, board.data!, run).map((action) => ({ ...action, label: t(`mom.recordingMenu.${action.verb}`) })),
      }))
    : [];
  if (!groups.some((group) => group.actions.length)) return null;

  return (
    <>
      <IconButton icon="more" label={t('mom.menu.title')} onPress={() => setOpen(true)} testID="meeting-more" />
      {open ? <MoreSheet title={t('mom.menu.title')} groups={groups} onClose={() => setOpen(false)} testID="meeting-more-sheet" /> : null}
    </>
  );
}
