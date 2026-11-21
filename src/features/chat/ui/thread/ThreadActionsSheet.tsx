import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { Sheet, SheetRow } from '../../../../ui/Sheet';
import { hasFeature, type ChatFeatures } from '../../features';
import type { ChannelInfo } from '../../odoo';
import { deleteThread, leave, pinConversation, setAnnouncement, setAutoTranslate, type TakenBack } from '../../threadActions';
import type { Message } from '../../types';
import { failureText } from '../actions/failure';
import { MeetingSheet } from '../actions/MeetingSheet';
import { FilesSheet, PinnedSheet, SearchSheet, ThreadsSheet } from './ListSheets';
import { MembersSheet } from './MembersSheet';
import { RenameSheet } from './RenameSheet';
import { ScheduledSheet } from './ScheduledSheet';

type Panel = 'menu' | 'pinned' | 'search' | 'files' | 'threads' | 'members' | 'rename' | 'scheduled' | 'meeting';

export function ThreadActionsSheet({
  channelId,
  type,
  name,
  info,
  features,
  myUserId,
  muted,
  threads,
  onClose,
  onNotify,
  onBackground,
  onMarkRead,
  onJump,
  onOpenChannel,
  onTakeBack,
  onNotice,
  onLeft,
}: {
  channelId: number;
  type: string;
  name: string;
  info: ChannelInfo | null;
  features: ChatFeatures;
  myUserId: number;
  muted: boolean;
  threads: { id: number; name: string }[];
  onClose: () => void;
  onNotify: () => void;
  onBackground?: () => void;
  onMarkRead: () => void;
  onJump: (message: Message) => void;
  onOpenChannel: (id: number) => void;
  onTakeBack: (taken: TakenBack) => void;
  onNotice: (text: string) => void;
  onLeft: () => void;
}) {
  const { t } = useTranslation('chat');
  const [panel, setPanel] = useState<Panel>('menu');
  const sub = !!info?.parentId;
  const channel = type === 'channel' && !sub;
  const manages = channel && hasFeature(features, 'announcement') && (features.channelAdmin || info?.role === 'owner' || info?.role === 'admin');
  const close = () => {
    setPanel('menu');
    onClose();
  };
  const done = (text: string) => {
    close();
    onNotice(text);
  };
  const result = (ok: string) => (next: { ok: boolean } & Partial<{ code: string; detail: string | null }>) =>
    next.ok ? onNotice(ok) : onNotice(failureText(t, { code: next.code ?? 'unknown', detail: next.detail ?? null }));
  const go = (next: Panel) => () => setPanel(next);
  const act = (work: () => void) => () => {
    close();
    work();
  };
  const confirmLeave = () => {
    close();
    Alert.alert(type === 'chat' ? t('threadActions.hideTitle') : t('threadActions.leaveTitle', { name }), type === 'chat' ? t('threadActions.hideBody') : t('threadActions.leaveBody'), [
      { text: t('act.cancel'), style: 'cancel' },
      {
        text: type === 'chat' ? t('threadActions.hide') : t('threadActions.leave'),
        style: 'destructive',
        onPress: () =>
          void leave(channelId, type).then((next) => {
            if (next.ok) onLeft();
            else onNotice(failureText(t, next));
          }),
      },
    ]);
  };
  const confirmDelete = () => {
    close();
    Alert.alert(t('threadActions.deleteTitle'), t('threadActions.deleteBody'), [
      { text: t('act.cancel'), style: 'cancel' },
      {
        text: t('threadActions.delete'),
        style: 'destructive',
        onPress: () =>
          void deleteThread(channelId).then((next) => {
            if (next.ok) onLeft();
            else onNotice(failureText(t, next));
          }),
      },
    ]);
  };
  if (panel === 'pinned') return <PinnedSheet channelId={channelId} onClose={close} onOpen={(message) => { close(); onJump(message); }} />;
  if (panel === 'search') return <SearchSheet channelId={channelId} onClose={close} onOpen={(message) => { close(); onJump(message); }} />;
  if (panel === 'files') return <FilesSheet channelId={channelId} onClose={close} />;
  if (panel === 'threads') return <ThreadsSheet threads={threads} onClose={close} onOpen={(id) => { close(); onOpenChannel(id); }} />;
  if (panel === 'members') return <MembersSheet channelId={channelId} manages={!!manages} canInvite={type !== 'chat'} onClose={close} onNotice={onNotice} />;
  if (panel === 'rename') return <RenameSheet channelId={channelId} type={type} name={name} description={info?.description ?? ''} onClose={close} onDone={done} />;
  if (panel === 'scheduled') return <ScheduledSheet channelId={channelId} onClose={close} onTakeBack={(taken) => { close(); onTakeBack(taken); }} onNotice={onNotice} />;
  if (panel === 'meeting') return <MeetingSheet channelId={channelId} messageId={null} onClose={close} onDone={done} />;
  const canRename = type === 'chat' || info?.editable === true;
  const on = {
    threads: type !== 'chat' && !sub && hasFeature(features, 'thread'),
    scheduled: hasFeature(features, 'send_later'),
    meeting: hasFeature(features, 'meeting'),
    pin: !sub && hasFeature(features, 'chat_filters'),
  };
  return (
    <Sheet title={name} onClose={close} testID="thread-actions">
      <SheetRow icon={muted ? 'bellOff' : 'bell'} label={t('threadActions.notifications')} onPress={act(onNotify)} testID="thread-action-notify" />
      <SheetRow icon="search" label={t('threadActions.search')} onPress={go('search')} testID="thread-action-search" />
      <SheetRow icon="pin" label={t('threadActions.pinned')} onPress={go('pinned')} testID="thread-action-pinned" />
      <SheetRow icon="file" label={t('threadActions.files')} onPress={go('files')} testID="thread-action-files" />
      {on.threads ? <SheetRow icon="thread" label={t('threadActions.threads')} detail={threads.length ? String(threads.length) : undefined} onPress={go('threads')} testID="thread-action-threads" /> : null}
      {type !== 'chat' ? <SheetRow icon="people" label={t('threadActions.members', { count: info?.memberCount ?? 0 })} onPress={go('members')} testID="thread-action-members" /> : null}
      {on.scheduled ? <SheetRow icon="clock" label={t('threadActions.scheduled')} onPress={go('scheduled')} testID="thread-action-scheduled" /> : null}
      {on.meeting ? <SheetRow icon="calendar" label={t('threadActions.meeting')} onPress={go('meeting')} testID="thread-action-meeting" /> : null}
      {on.pin ? (
        <SheetRow icon="pin" label={info?.pinned ? t('threadActions.unpinConversation') : t('threadActions.pinConversation')} onPress={act(() => void pinConversation(channelId, !info?.pinned).then(result(info?.pinned ? t('threadActions.unpinned') : t('threadActions.pinnedDone'))))} testID="thread-action-pin" />
      ) : null}
      {features.translateLanguage ? (
        <SheetRow
          icon="globe"
          label={features.translateAuto ? t('threadActions.translateOff') : t('threadActions.translateOn', { language: features.translateLanguage })}
          onPress={act(() => void setAutoTranslate(!features.translateAuto).then(result(features.translateAuto ? t('threadActions.translateStopped') : t('threadActions.translateStarted'))))}
          testID="thread-action-translate"
        />
      ) : null}
      {manages ? (
        <SheetRow icon="flag" label={info?.announcement ? t('threadActions.announcementOff') : t('threadActions.announcementOn')} onPress={act(() => void setAnnouncement(channelId, !info?.announcement).then(result(t('threadActions.announcementChanged'))))} testID="thread-action-announcement" />
      ) : null}
      {canRename ? <SheetRow icon="edit" label={type === 'chat' ? t('threadActions.rename') : t('threadActions.info')} onPress={go('rename')} testID="thread-action-rename" /> : null}
      {onBackground ? <SheetRow icon="image" label={t('thread.background')} onPress={act(onBackground)} testID="thread-action-background" /> : null}
      <SheetRow icon="checkDouble" label={t('threadActions.markRead')} onPress={act(onMarkRead)} testID="thread-action-read" />
      {sub && info?.createdBy === myUserId ? <SheetRow icon="trash" label={t('threadActions.delete')} danger onPress={confirmDelete} testID="thread-action-delete" /> : null}
      {!sub ? <SheetRow icon="back" label={type === 'chat' ? t('threadActions.hide') : t('threadActions.leave')} danger onPress={confirmLeave} testID="thread-action-leave" /> : null}
    </Sheet>
  );
}
