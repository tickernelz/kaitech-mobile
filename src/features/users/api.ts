import { rpc } from '../../api/odoo';
import type { Role } from '../../auth/access';
import type { Account } from '../../auth/oauth';
import { detailFrom, filterQuery, overviewFrom, type Detail, type Filter, type Overview } from './door';

const model = 'res.users';
export const pageSize = 50;

export async function overview(account: Account, search: string, filter: Filter, limit: number): Promise<Overview> {
  const { role, active } = filterQuery(filter);
  return overviewFrom(await rpc<unknown>(account, model, 'kaitech_role_overview', [], { search, role, active, offset: 0, limit }));
}

export async function findByEmail(account: Account, email: string): Promise<number | null> {
  const found = overviewFrom(await rpc<unknown>(account, model, 'kaitech_role_overview', [], { search: email, role: false, active: null, offset: 0, limit: 5 }));
  const wanted = email.trim().toLowerCase();
  return found.people.find((person) => person.login.toLowerCase() === wanted || person.email?.toLowerCase() === wanted)?.id ?? null;
}

export async function detail(account: Account, userId: number): Promise<Detail> {
  return detailFrom(await rpc<unknown>(account, model, 'kaitech_role_detail', [userId]));
}

export async function setRole(account: Account, userId: number, role: Role): Promise<Detail> {
  return detailFrom(await rpc<unknown>(account, model, 'kaitech_set_role', [userId, role]));
}

export async function setCapability(account: Account, userId: number, capability: string, on: boolean): Promise<Detail> {
  return detailFrom(await rpc<unknown>(account, model, 'kaitech_set_capability', [userId, capability, on]));
}

export async function invite(account: Account, name: string, email: string, role: Role): Promise<Detail> {
  return detailFrom(await rpc<unknown>(account, model, 'kaitech_invite', [name, email, role]));
}

export async function deactivate(account: Account, userId: number): Promise<Detail> {
  return detailFrom(await rpc<unknown>(account, model, 'kaitech_deactivate', [userId]));
}

export async function reactivate(account: Account, userId: number): Promise<Detail> {
  return detailFrom(await rpc<unknown>(account, model, 'kaitech_reactivate', [userId]));
}
