import { useResource } from '../../api/resource';
import { overview, pendingCount } from './odoo';

export function useActivityOverview() {
  return useResource('activity.odoo', overview, 60_000);
}

export function usePendingActivities(): number {
  const items = useActivityOverview();
  return items.data ? pendingCount(items.data.groups) : 0;
}
