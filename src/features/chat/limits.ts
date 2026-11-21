import { useEffect, useState } from 'react';
import { ApiError, bearer } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import { onAccountForgotten } from '../../auth/session';
import { limitsOf, type Limits, type UploadKind } from './uploadRule';

const known = new Map<string, Promise<Limits>>();

onAccountForgotten((accountId) => known.delete(accountId));

function load(account: Account): Promise<Limits> {
  const held = known.get(account.id);
  if (held) return held;
  const loading = bearer<unknown>(account, '/kaitech_mobile/upload_rule').then(limitsOf, (error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return {};
    known.delete(account.id);
    return {};
  });
  known.set(account.id, loading);
  return loading;
}

export function useUploadLimit(account: Account | null | undefined, kind: UploadKind): number | null {
  const [limit, setLimit] = useState<{ accountId: string; most: number | null } | null>(null);
  useEffect(() => {
    if (!account) return;
    let live = true;
    void load(account).then((limits) => {
      if (live) setLimit({ accountId: account.id, most: limits[kind] ?? null });
    });
    return () => {
      live = false;
    };
  }, [account, kind]);
  return account && limit?.accountId === account.id ? limit.most : null;
}
