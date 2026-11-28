import { hasFeature, type ChatFeatures } from './features';
import { plainText } from './html';
import { isRemoved } from './odoo';
import type { Message } from './types';
import type { ActionOptions } from './ui/MessageActions';

export const recallMs = 24 * 60 * 60 * 1000;

export type OptionsContext = { partnerId: number; features: ChatFeatures; channelType: string; inSubThread: boolean; now: number; client?: boolean };

export function messageOptions(message: Message, { partnerId, features, channelType, inSubThread, now, client }: OptionsContext): ActionOptions {
  const removed = isRemoved(message);
  const comment = message.type === 'comment';
  const mine = message.authorId === partnerId;
  const rich = !!message.rich;
  const text = !removed && !rich && !!plainText(message.body);
  const editable = comment && !removed && (mine || features.isAdmin);
  const recallClosed = hasFeature(features, 'recall_limit') && mine && now - message.date > recallMs;
  const fromMessage = hasFeature(features, 'task_from_message') && comment && !removed;
  if (client) return { emoji: !removed, reply: !removed, copy: text, delete: comment && !removed && mine && !recallClosed, reactions: message.reactions.length > 0 };
  return {
    emoji: !removed,
    reply: !removed,
    copy: text,
    sticker: !removed && !!message.rich && 'sticker' in message.rich && message.rich.sticker.source === 'pack',
    forward: hasFeature(features, 'forward') && comment && !removed,
    edit: editable && !rich,
    delete: editable && !recallClosed,
    thread: channelType !== 'chat' && !inSubThread,
    pin: comment && !removed,
    star: !removed,
    unread: true,
    link: true,
    translate: !!features.translateLanguage && comment && text,
    task: fromMessage && features.canMakeTask,
    activity: fromMessage,
    meeting: hasFeature(features, 'meeting') && comment,
    reactions: message.reactions.length > 0,
    readers: hasFeature(features, 'read_by') && channelType === 'channel' && (mine || features.readByAdmin),
  };
}
