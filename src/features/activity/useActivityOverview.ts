import { update, useResource } from '../../api/resource';
import type { Account } from '../../auth/oauth';
import { accountKnown } from '../../auth/session';
import { useCan } from '../../auth/useAccess';
import { overview, pendingCount, systray } from './odoo';

const systrayPath = 'activity.systray';

async function overviewAndBadge(account: Account) {
  const answer = await overview(account);
  if (accountKnown(account.id)) update(`${account.id}:${systrayPath}`, () => ({ groups: answer.groups, meetings: answer.meetings }));
  return answer;
}

export function useActivityOverview() {
  return useResource('activity.odoo', overviewAndBadge, 60_000);
}

export function usePendingActivities(): number {
  const counts = useResource(useCan('team') ? systrayPath : null, systray, 60_000);
  return counts.data ? pendingCount(counts.data.groups) : 0;
}
