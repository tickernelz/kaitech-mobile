import { rpc } from '../../api/odoo';
import type { Account } from '../../auth/oauth';

const DEPARTMENT = 'ck.mom.client.department';
const EMPLOYEE = 'ck.mom.client.employee';

type Named = { id: number; name: string };

export type Period = { start: string; end: string; count: number; target: number; status: 'unmeasured' | 'pending' | 'met' | 'below' | string };

export type ClientDepartment = {
  id: number;
  name: string;
  sequence: number;
  active: boolean;
  weeklyTarget: number;
  monthlyTarget: number;
  kpiSince: string | false;
  employees: number;
  programmeDepartmentIds: number[];
};

export type ClientEmployee = {
  id: number;
  name: string;
  nickname: string;
  title: string;
  canonical: string;
  email: string;
  phone: string;
  active: boolean;
  department: Named | false;
  aliases: string[];
  linked: number;
};

export type AliasGroup = { key: string; said: string; items: { id: number; code: string; name: string; said: string; programme: Named }[] };

export type ClientBoard = {
  clients: Named[];
  canChange: boolean;
  seesFollowups: boolean;
  isClient: boolean;
  client: Named | false;
  programmeDepartments: (Named & { programme: string })[];
  departments: ClientDepartment[];
  kpi: {
    departments: { id: number; name: string; currentWeek: Period; lastWeek: Period; currentMonth: Period; lastMonth: Period }[];
    alerts: { departmentId: number; name: string; scope: 'week' | 'month'; count: number; target: number; start: string; end: string }[];
  };
  employees: ClientEmployee[];
  employee_page: { offset: number; limit: number; total: number };
  unlinked: AliasGroup[];
};

export type ClientStatus = 'active' | 'inactive' | 'all';

export type ClientQuery = { partner: number | false; status: ClientStatus; department: number; search: string; limit: number };

export function clientBoard(account: Account, query: ClientQuery): Promise<ClientBoard> {
  return rpc(account, DEPARTMENT, 'client_board', [], {
    partner_id: query.partner,
    status: query.status,
    department_id: query.department,
    search: query.search,
    offset: 0,
    limit: query.limit,
  });
}

export type DepartmentForm = { name: string; sequence: string; programmeDepartments: number[]; weeklyTarget: string; monthlyTarget: string };

export async function saveDepartment(account: Account, client: number, existing: ClientDepartment | null, form: DepartmentForm): Promise<number> {
  const values = {
    name: form.name.trim(),
    sequence: Number.parseInt(form.sequence, 10) || 0,
    programme_department_ids: [[6, 0, form.programmeDepartments]],
  };
  let id = existing?.id ?? 0;
  if (existing) await rpc(account, DEPARTMENT, 'write', [[existing.id], values]);
  else id = await rpc<number>(account, DEPARTMENT, 'create', [{ ...values, client_partner_id: client }]);
  const weekly = Number.parseInt(form.weeklyTarget, 10) || 0;
  const monthly = Number.parseInt(form.monthlyTarget, 10) || 0;
  if (!existing || weekly !== existing.weeklyTarget || monthly !== existing.monthlyTarget) {
    await rpc(account, DEPARTMENT, 'action_set_targets', [[id]], { weekly_target: weekly, monthly_target: monthly });
  }
  return id;
}

export function setDepartmentActive(account: Account, department: number, active: boolean): Promise<unknown> {
  return rpc(account, DEPARTMENT, 'write', [[department], { active }]);
}

export type EmployeeForm = { name: string; nickname: string; title: string; email: string; phone: string; department: number | false; active: boolean; aliases: string };

export function employeeValues(form: EmployeeForm): Record<string, unknown> {
  const aliases = form.aliases
    .split('\n')
    .map((one) => one.trim())
    .filter(Boolean)
    .join('\n');
  return {
    name: form.name.trim(),
    nickname: form.nickname.trim() || false,
    formal_title: form.title.trim() || false,
    email: form.email.trim() || false,
    phone: form.phone.trim() || false,
    department_id: form.department,
    active: form.active,
    aliases: aliases || false,
  };
}

export async function saveEmployee(account: Account, client: number, existing: ClientEmployee | null, form: EmployeeForm): Promise<void> {
  if (existing) await rpc(account, EMPLOYEE, 'write', [[existing.id], employeeValues(form)]);
  else await rpc(account, EMPLOYEE, 'create', [{ ...employeeValues(form), client_partner_id: client }]);
}

export function linkAlias(account: Account, group: AliasGroup, employee: number): Promise<{ affected: number; ambiguous: number; learned: boolean; employee: { name: string } }> {
  return rpc(account, 'ck.meeting.action.update', 'link_followup_pic', [], { action_id: group.items[0].id, employee_id: employee });
}
