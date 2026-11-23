import { rpc } from '../../api/odoo';
import { useResource } from '../../api/resource';
import type { Account } from '../../auth/oauth';

const groups = {
  discoveryMember: 'erp_discovery.group_discovery_member',
  discoveryProgram: 'erp_discovery.group_discovery_program',
  client: 'kaitech_mom.group_mom_client',
  manager: 'kaitech_mom.group_mom_manager',
  system: 'base.group_system',
} as const;

export type MomAccess = Record<keyof typeof groups, boolean>;

export async function momAccess(account: Account): Promise<MomAccess> {
  const entries = Object.entries(groups) as [keyof MomAccess, string][];
  const answers = await Promise.all(entries.map(([, group]) => rpc<boolean>(account, 'res.users', 'has_group', [account.userId, group])));
  return Object.fromEntries(entries.map(([key], index) => [key, answers[index] === true])) as MomAccess;
}

export function useMomAccess(): MomAccess | null {
  return useResource('mom.access', momAccess, 10 * 60_000).data ?? null;
}

export function seesClientOrg(access: MomAccess | null): boolean {
  return !!access && (access.discoveryMember || access.discoveryProgram || access.client);
}
