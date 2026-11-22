import type { TFunction } from 'i18next';
import type { SheetAction } from '../../../ui/ActionSheet';
import { deferUndoable, showFailure } from '../../../ui/undo';
import { muteConversation, removalOf, setConversationPinned, setConversationRead, type Removal } from '../chat';
import { muteChoices } from '../notify';
import type { Conversation } from '../types';

type ChatT = TFunction<'chat'>;

function settled(t: ChatT) {
  return (failure: string | null) => {
    if (failure) showFailure(t(failure === 'network' ? 'notify.failedNetwork' : 'rowActions.failed'));
  };
}

function remove(t: ChatT, conversation: Conversation, kind: Removal) {
  const removal = removalOf(conversation.id, kind);
  if (!removal) return;
  const labels: Record<Removal, string> = {
    archive: t('rowActions.archivedDone'),
    unarchive: t('rowActions.unarchivedDone'),
    hide: t('rowActions.hiddenDone'),
    leave: t('rowActions.leftDone', { name: conversation.name }),
  };
  deferUndoable({ label: labels[kind], ...removal });
}

export function conversationActions(t: ChatT, conversation: Conversation, inArchive = false): SheetAction[] {
  const done = settled(t);
  const actions: SheetAction[] = [];
  if (conversation.pinned !== null && !inArchive) {
    const pinned = conversation.pinned;
    actions.push({
      key: 'pin',
      icon: pinned ? 'pinOff' : 'pin',
      label: t(pinned ? 'rowActions.unpin' : 'rowActions.pin'),
      onPress: () => void setConversationPinned(conversation.id, !pinned).then(done),
    });
  }
  if (conversation.mutedUntil) {
    actions.push({ key: 'mute', icon: 'bell', label: t('rowActions.unmute'), onPress: () => void muteConversation(conversation.id, 0).then(done) });
  } else {
    actions.push({
      key: 'mute',
      icon: 'bellOff',
      label: t('rowActions.mute'),
      choices: muteChoices.map((choice) => ({
        key: `mute-${choice.key}`,
        icon: 'bellOff',
        label: t(`notify.mute.${choice.key}`),
        onPress: () => void muteConversation(conversation.id, choice.minutes).then(done),
      })),
    });
  }
  if (conversation.last) {
    const unread = conversation.unread > 0;
    actions.push({
      key: 'read',
      icon: unread ? 'checkDouble' : 'unread',
      label: t(unread ? 'rowActions.markRead' : 'rowActions.markUnread'),
      short: t(unread ? 'rowActions.read' : 'rowActions.unread'),
      onPress: () => void setConversationRead(conversation.id, unread).then(done),
    });
  }
  if (inArchive) {
    actions.push({ key: 'archive', icon: 'unarchive', label: t('rowActions.unarchive'), onPress: () => remove(t, conversation, 'unarchive') });
  } else if (conversation.archived !== null) {
    actions.push({ key: 'archive', icon: 'archive', label: t('rowActions.archive'), onPress: () => remove(t, conversation, 'archive') });
  }
  if (conversation.type === 'chat') {
    actions.push({ key: 'remove', icon: 'trash', label: t('rowActions.hide'), tone: 'danger', onPress: () => remove(t, conversation, 'hide') });
  } else {
    actions.push({ key: 'remove', icon: 'leave', label: t('rowActions.leave'), tone: 'danger', onPress: () => remove(t, conversation, 'leave') });
  }
  return actions;
}
