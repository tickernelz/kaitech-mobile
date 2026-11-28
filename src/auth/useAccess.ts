import { can, legacyAccess, type Access, type Capability } from './access';
import type { Account } from './oauth';
import { useSession } from './session';

export function accessOf(account: Account | null | undefined): Access {
  return account?.access ?? legacyAccess;
}

export function useAccess(): Access {
  return accessOf(useSession().active);
}

export function useCan(capability: Capability): boolean {
  return can(useAccess(), capability);
}
