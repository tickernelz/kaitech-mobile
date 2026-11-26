import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState } from 'react-native';
import { beforeAccountLeaves, onAccountForgotten } from '../../auth/session';
import { onDelivered } from './chat';
import { forgetShares, liveShares, liveTask, pushFix, stopShare, syncAllLive, trackShare } from './live';
import { fixOf } from './places';

TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(liveTask, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await pushFix(fixOf(data.locations[data.locations.length - 1]));
});

onDelivered((sent) => {
  const rich = sent.pending.rich;
  if (!rich || !('location' in rich) || rich.location.liveMinutes === undefined) return;
  trackShare(sent.pending.accountId, { messageId: sent.messageId, channelId: sent.pending.channelId, until: Date.now() + rich.location.liveMinutes * 60000 });
});

beforeAccountLeaves(async (account) => {
  await Promise.all(liveShares(account.id, 0).map((share) => stopShare(account, share.messageId)));
});

onAccountForgotten((accountId) => {
  forgetShares(accountId);
});

AppState.addEventListener('change', (next) => {
  if (next === 'active') void syncAllLive();
});
if (AppState.currentState === 'active') void syncAllLive();
