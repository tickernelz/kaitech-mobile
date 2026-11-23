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
        actions: [
          ...(card.state === 'transcribed'
            ? [{ key: `editor-${card.id}`, icon: 'doc' as const, label: t('mom.recordingMenu.editor'), onPress: () => router.push({ pathname: '/mom/transcript/[recording]', params: { recording: String(card.id) } }) }]
            : []),
          {
            key: `departments-${card.id}`,
            icon: 'people' as const,
            label: t('mom.recordingMenu.departments'),
            detail: [card.department ? card.department.name : '', ...(card.clientDepartments ?? []).map((one) => one.name)].filter(Boolean).join(', ') || undefined,
            onPress: () => router.push({ pathname: '/mom/departments', params: { recording: String(card.id), meeting: String(meeting) } }),
          },
          { key: `history-${card.id}`, icon: 'history' as const, label: t('mom.recordingMenu.history'), onPress: () => router.push({ pathname: '/mom/history/[recording]', params: { recording: String(card.id) } }) },
          ...verbActions(card, board.data!, run).map((action) => ({ ...action, label: t(`mom.recordingMenu.${action.verb}`) })),
        ],
      }))
    : [];
  if (board.data && !board.data.isClient) {
    const assist = (part: 'notes' | 'solusi' | 'tasks', icon: 'doc' | 'bulb' | 'steps') => ({
      key: `assist-${part}`,
      icon,
      label: t(`mom.assist.${part}.title`),
      detail: t(`mom.assist.${part}.detail`),
      onPress: () => router.push({ pathname: '/mom/assist/[part]', params: { part, meeting: String(meeting) } }),
    });
    groups.unshift({ key: 'assist', title: t('mom.assist.group'), actions: [assist('notes', 'doc'), assist('solusi', 'bulb'), assist('tasks', 'steps')] });
  }
  const programme = cards[0]?.engagement.id;
  if (board.data?.isClient && programme) {
    groups.unshift({
      key: 'ask',
      actions: [{ key: 'ask', icon: 'chat', label: t('mom.recordingMenu.ask'), onPress: () => router.push({ pathname: '/program/[id]/coworker', params: { id: String(programme), ask: '1' } }) }],
    });
  }
  if (!groups.some((group) => group.actions.length)) return null;

  return (
    <>
      <IconButton icon="more" label={t('mom.menu.title')} onPress={() => setOpen(true)} testID="meeting-more" />
      {open ? <MoreSheet title={t('mom.menu.title')} groups={groups} onClose={() => setOpen(false)} testID="meeting-more-sheet" /> : null}
    </>
  );
}
