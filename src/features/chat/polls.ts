import { route } from '../../api/odoo';
import { getChat, patchMessages } from './chat';
import { run, type Result } from './messageActions';
import { messagePatches } from './odoo';
import type { Message, Poll } from './types';

export function chosenBy(poll: Poll, partnerId: number): number[] {
  return poll.options.filter((option) => option.voters.some((voter) => voter.id === partnerId)).map((option) => option.id);
}

export function nextChoice(poll: Poll, current: number[], optionId: number): number[] {
  if (current.includes(optionId)) return current.filter((id) => id !== optionId);
  return poll.multiple ? [...current, optionId] : [optionId];
}

export function withVote(poll: Poll, partnerId: number, optionIds: number[]): Poll {
  const options = poll.options.map((option) => {
    const had = option.voters.some((voter) => voter.id === partnerId);
    const has = optionIds.includes(option.id);
    if (had === has) return option;
    const voters = has ? [...option.voters, { id: partnerId, name: '' }] : option.voters.filter((voter) => voter.id !== partnerId);
    return { ...option, voters, votes: Math.max(0, option.votes + (has ? 1 : -1)) };
  });
  const before = poll.options.some((option) => option.voters.some((voter) => voter.id === partnerId));
  const after = optionIds.length > 0;
  return { ...poll, options, votersCount: Math.max(0, poll.votersCount + (after === before ? 0 : after ? 1 : -1)) };
}

export function shareOf(votes: number, poll: Poll): number {
  const total = poll.options.reduce((sum, option) => sum + option.votes, 0);
  return total > 0 ? votes / total : 0;
}

const chains = new Map<number, Promise<unknown>>();
const confirmed = new Map<number, number[]>();

function queued<T>(messageId: number, work: () => Promise<T>): Promise<T> {
  const next = (chains.get(messageId) ?? Promise.resolve()).then(work, work);
  chains.set(messageId, next);
  void next.finally(() => chains.get(messageId) === next && chains.delete(messageId));
  return next;
}

function pollOf(messageId: number, channelId: number): Poll | null {
  const rich = getChat().threads[channelId]?.messages.find((message) => message.id === messageId)?.rich;
  return rich && 'poll' in rich ? rich.poll : null;
}

function applied(data: unknown) {
  const store = data && typeof data === 'object' && 'store_data' in data ? (data as { store_data: unknown }).store_data : data;
  patchMessages(messagePatches(store));
}

export function vote(message: Pick<Message, 'id' | 'channelId'>, optionIds: number[]): Promise<Result<null>> {
  const partnerId = getChat().partnerId;
  const before = pollOf(message.id, message.channelId);
  if (before && !chains.has(message.id)) confirmed.set(message.id, chosenBy(before, partnerId));
  if (before) patchMessages(new Map([[message.id, { rich: { poll: withVote(before, partnerId, optionIds) } }]]));
  const done = queued(message.id, async () => {
    const result = await run(async (account) => {
      applied(await route<unknown>(account, '/kaitech_chat/poll/vote', { message_id: message.id, option_ids: optionIds }));
      return null;
    });
    const now = pollOf(message.id, message.channelId);
    if (result.ok) {
      confirmed.set(message.id, now ? chosenBy(now, partnerId) : optionIds);
    } else if (now && confirmed.has(message.id)) {
      patchMessages(new Map([[message.id, { rich: { poll: withVote(now, partnerId, confirmed.get(message.id) ?? []) } }]]));
    }
    return result;
  });
  void done.finally(() => !chains.has(message.id) && confirmed.delete(message.id));
  return done;
}

export function closePoll(message: Pick<Message, 'id'>): Promise<Result<null>> {
  return queued(message.id, () =>
    run(async (account) => {
      applied(await route<unknown>(account, '/kaitech_chat/poll/close', { message_id: message.id }));
      return null;
    }),
  );
}
