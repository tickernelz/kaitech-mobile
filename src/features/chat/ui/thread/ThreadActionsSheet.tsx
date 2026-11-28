import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetItem } from '../../../../ui/Sheet';
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
import { confirm } from '../../../../ui/dialog';
import { useCan } from '../../../../auth/useAccess';

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
  onWork,
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
  onWork?: () => void;
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
  const team = useCan('team');
  const sub = !!info?.parentId;
  const channel = type === 'channel' && !sub;
  const manages = team && channel && hasFeature(features, 'announcement') && (features.channelAdmin || info?.role === 'owner' || info?.role === 'admin');
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
  const confirmLeave = async () => {
    close();
    const go = await confirm({
      title: type === 'chat' ? t('threadActions.hideTitle') : t('threadActions.leaveTitle', { name }),
      body: type === 'chat' ? t('threadActions.hideBody') : t('threadActions.leaveBody'),
      cancel: t('act.cancel'),
      confirm: type === 'chat' ? t('threadActions.hide') : t('threadActions.leave'),
      danger: true,
      icon: type === 'chat' ? 'archive' : 'leave',
      testID: 'thread-leave-dialog',
    });
    if (!go) return;
    const next = await leave(channelId, type);
    if (next.ok) onLeft();
    else onNotice(failureText(t, next));
  };
  const confirmDelete = async () => {
    close();
    const go = await confirm({ title: t('threadActions.deleteTitle'), body: t('threadActions.deleteBody'), cancel: t('act.cancel'), confirm: t('threadActions.delete'), danger: true, icon: 'trash', testID: 'thread-delete-dialog' });
    if (!go) return;
    const next = await deleteThread(channelId);
    if (next.ok) onLeft();
    else onNotice(failureText(t, next));
  };
  if (panel === 'pinned') return <PinnedSheet channelId={channelId} onClose={close} onOpen={(message) => { close(); onJump(message); }} />;
  if (panel === 'search') return <SearchSheet channelId={channelId} onClose={close} onOpen={(message) => { close(); onJump(message); }} />;
  if (panel === 'files') return <FilesSheet channelId={channelId} onClose={close} />;
  if (panel === 'threads') return <ThreadsSheet threads={threads} onClose={close} onOpen={(id) => { close(); onOpenChannel(id); }} />;
  if (panel === 'members') return <MembersSheet channelId={channelId} manages={!!manages} canInvite={team && type !== 'chat'} onClose={close} onNotice={onNotice} />;
  if (panel === 'rename') return <RenameSheet channelId={channelId} type={type} name={name} description={info?.description ?? ''} onClose={close} onDone={done} />;
  if (panel === 'scheduled') return <ScheduledSheet channelId={channelId} onClose={close} onTakeBack={(taken) => { close(); onTakeBack(taken); }} onNotice={onNotice} />;
  if (panel === 'meeting') return <MeetingSheet channelId={channelId} messageId={null} onClose={close} onDone={done} />;
  const canRename = team && (type === 'chat' || info?.editable === true);
  const on = {
    threads: team && type !== 'chat' && !sub && hasFeature(features, 'thread'),
    scheduled: team && hasFeature(features, 'send_later'),
    meeting: team && hasFeature(features, 'meeting'),
    pin: team && !sub && hasFeature(features, 'chat_filters'),
  };
  return (
    <Sheet title={name} onClose={close} testID="thread-actions">
      <SheetItem icon={muted ? 'bellOff' : 'bell'} label={t('threadActions.notifications')} onPress={act(onNotify)} testID="thread-action-notify" />
      {team && onWork ? <SheetItem icon="sparkle" label={t('threadActionsWork.label')} onPress={act(onWork)} testID="thread-action-work" /> : null}
      {team ? <SheetItem icon="search" label={t('threadActions.search')} onPress={go('search')} testID="thread-action-search" /> : null}
      {team ? <SheetItem icon="pin" label={t('threadActions.pinned')} onPress={go('pinned')} testID="thread-action-pinned" /> : null}
      <SheetItem icon="file" label={t('threadActions.files')} onPress={go('files')} testID="thread-action-files" />
      {on.threads ? <SheetItem icon="thread" label={t('threadActions.threads')} detail={threads.length ? String(threads.length) : undefined} onPress={go('threads')} testID="thread-action-threads" /> : null}
      {type !== 'chat' ? <SheetItem icon="people" label={t('threadActions.members', { count: info?.memberCount ?? 0 })} onPress={go('members')} testID="thread-action-members" /> : null}
      {on.scheduled ? <SheetItem icon="clock" label={t('threadActions.scheduled')} onPress={go('scheduled')} testID="thread-action-scheduled" /> : null}
      {on.meeting ? <SheetItem icon="calendar" label={t('threadActions.meeting')} onPress={go('meeting')} testID="thread-action-meeting" /> : null}
      {on.pin ? (
        <SheetItem icon="pin" label={info?.pinned ? t('threadActions.unpinConversation') : t('threadActions.pinConversation')} onPress={act(() => void pinConversation(channelId, !info?.pinned).then(result(info?.pinned ? t('threadActions.unpinned') : t('threadActions.pinnedDone'))))} testID="thread-action-pin" />
      ) : null}
      {features.translateLanguage ? (
        <SheetItem
          icon="globe"
          label={features.translateAuto ? t('threadActions.translateOff') : t('threadActions.translateOn', { language: features.translateLanguage })}
          onPress={act(() => void setAutoTranslate(!features.translateAuto).then(result(features.translateAuto ? t('threadActions.translateStopped') : t('threadActions.translateStarted'))))}
          testID="thread-action-translate"
        />
      ) : null}
      {manages ? (
        <SheetItem icon="flag" label={info?.announcement ? t('threadActions.announcementOff') : t('threadActions.announcementOn')} onPress={act(() => void setAnnouncement(channelId, !info?.announcement).then(result(t('threadActions.announcementChanged'))))} testID="thread-action-announcement" />
      ) : null}
      {canRename ? <SheetItem icon="edit" label={type === 'chat' ? t('threadActions.rename') : t('threadActions.info')} onPress={go('rename')} testID="thread-action-rename" /> : null}
      {onBackground ? <SheetItem icon="image" label={t('thread.background')} onPress={act(onBackground)} testID="thread-action-background" /> : null}
      <SheetItem icon="checkDouble" label={t('threadActions.markRead')} onPress={act(onMarkRead)} testID="thread-action-read" />
      {sub && info?.createdBy === myUserId ? <SheetItem icon="trash" label={t('threadActions.delete')} danger onPress={confirmDelete} testID="thread-action-delete" /> : null}
      {!sub ? <SheetItem icon="back" label={type === 'chat' ? t('threadActions.hide') : t('threadActions.leave')} danger onPress={confirmLeave} testID="thread-action-leave" /> : null}
    </Sheet>
  );
}
