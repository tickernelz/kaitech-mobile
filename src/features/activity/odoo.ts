import type { Account } from '../../auth/oauth';
import { route, rpc } from '../../api/odoo';

export type ActivityState = 'overdue' | 'today' | 'planned';

export type Activity = {
  id: number;
  summary: string;
  note: string;
  typeId: number | null;
  typeName: string;
  category: string;
  deadline: string;
  state: ActivityState;
  resModel: string;
  resId: number;
  resName: string;
  modelName: string;
  userId: number | null;
  userName: string;
  canWrite: boolean;
};

export type Meeting = { id: number; name: string; start: string; allDay: boolean };

export type ActivityGroup = { model: string; name: string; overdue: number; today: number; planned: number; total: number };

export type Overview = { groups: ActivityGroup[]; meetings: Meeting[]; activities: Activity[] };

export type ActivityType = { id: number; name: string; category: string; summary: string; delayCount: number; delayUnit: string; suggested: number[] };

export type Person = { id: number; name: string };

export type ActivityInput = { typeId: number | null; summary: string; note: string; deadline: string; userId: number | null };

export type Filter = 'all' | ActivityState;

const activityFields = [
  'summary',
  'note',
  'activity_type_id',
  'activity_category',
  'date_deadline',
  'state',
  'res_model',
  'res_id',
  'res_name',
  'res_model_id',
  'user_id',
  'can_write',
];

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function pair(value: unknown): [number, string] | null {
  return Array.isArray(value) && typeof value[0] === 'number' ? [value[0], text(value[1])] : null;
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };

export function plainNote(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => entities[name])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function noteHtml(plain: string): string {
  const escaped = plain.trim().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped ? escaped.split(/\n/).map((line) => `<p>${line || '<br>'}</p>`).join('') : '';
}

function stateOf(value: unknown): ActivityState {
  return value === 'overdue' || value === 'today' ? value : 'planned';
}

export function activityFrom(row: Record<string, unknown>): Activity | null {
  if (typeof row.id !== 'number' || typeof row.res_model !== 'string') return null;
  const type = pair(row.activity_type_id);
  const user = pair(row.user_id);
  const model = pair(row.res_model_id);
  return {
    id: row.id,
    summary: text(row.summary),
    note: plainNote(text(row.note)),
    typeId: type?.[0] ?? null,
    typeName: type?.[1] ?? '',
    category: text(row.activity_category) || 'default',
    deadline: text(row.date_deadline),
    state: stateOf(row.state),
    resModel: row.res_model,
    resId: count(row.res_id),
    resName: text(row.res_name),
    modelName: model?.[1] || row.res_model,
    userId: user?.[0] ?? null,
    userName: user?.[1] ?? '',
    canWrite: row.can_write === true,
  };
}

export function groupsFrom(value: unknown): { groups: ActivityGroup[]; meetings: Meeting[] } {
  const groups: ActivityGroup[] = [];
  const meetings: Meeting[] = [];
  for (const raw of Array.isArray(value) ? value : []) {
    if (!raw || typeof raw !== 'object') continue;
    const group = raw as Record<string, unknown>;
    if (group.type === 'meeting' && Array.isArray(group.meetings)) {
      for (const meeting of group.meetings as Record<string, unknown>[]) {
        if (typeof meeting?.id === 'number') meetings.push({ id: meeting.id, name: text(meeting.name), start: text(meeting.start), allDay: meeting.allday === true });
      }
      continue;
    }
    if (typeof group.model !== 'string') continue;
    groups.push({
      model: group.model,
      name: text(group.name) || group.model,
      overdue: count(group.overdue_count),
      today: count(group.today_count),
      planned: count(group.planned_count),
      total: count(group.total_count),
    });
  }
  return { groups, meetings };
}

export function pendingCount(groups: ActivityGroup[]): number {
  return groups.reduce((sum, group) => sum + group.overdue + group.today, 0);
}

export function filtered(activities: Activity[], filter: Filter): Activity[] {
  return filter === 'all' ? activities : activities.filter((activity) => activity.state === filter);
}

export function tally(activities: Activity[]): Record<Filter, number> {
  const counts: Record<Filter, number> = { all: activities.length, overdue: 0, today: 0, planned: 0 };
  for (const activity of activities) counts[activity.state] += 1;
  return counts;
}

export type Section = { key: string; title: string; data: Activity[] };

export function byModel(activities: Activity[], groups: ActivityGroup[]): Section[] {
  const titles = new Map<string, string>();
  for (const group of groups) titles.set(group.model, titles.has(group.model) ? `${titles.get(group.model)} · ${group.name}` : group.name);
  const sections = new Map<string, Section>();
  for (const activity of activities) {
    const section = sections.get(activity.resModel) ?? { key: activity.resModel, title: titles.get(activity.resModel) ?? activity.modelName, data: [] };
    section.data.push(activity);
    sections.set(activity.resModel, section);
  }
  const order = groups.map((group) => group.model);
  const rank = (model: string) => (order.includes(model) ? order.indexOf(model) : order.length);
  return [...sections.values()].sort((a, b) => rank(a.key) - rank(b.key) || a.title.localeCompare(b.title));
}

export function isoDay(day: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function dayOf(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export function daysUntil(iso: string, today: Date): number | null {
  const day = dayOf(iso);
  if (!day) return null;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((day.getTime() - start.getTime()) / 86_400_000);
}

export function defaultDeadline(type: ActivityType | undefined, today: Date): string {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (type && type.delayCount > 0) {
    if (type.delayUnit === 'weeks') day.setDate(day.getDate() + type.delayCount * 7);
    else if (type.delayUnit === 'months') day.setMonth(day.getMonth() + type.delayCount);
    else day.setDate(day.getDate() + type.delayCount);
  }
  return isoDay(day);
}

export async function overview(account: Account): Promise<Overview> {
  const [data, rows] = await Promise.all([
    route<Record<string, unknown>>(account, '/mail/data', { fetch_params: ['systray_get_activities'] }),
    rpc<Record<string, unknown>[]>(account, 'mail.activity', 'search_read', [[['user_id', '=', account.userId]]], { fields: activityFields, order: 'date_deadline asc, id asc', limit: 500 }),
  ]);
  const store = (data?.Store ?? data) as Record<string, unknown> | undefined;
  const { groups, meetings } = groupsFrom(store?.activityGroups);
  return { groups, meetings, activities: rows.map(activityFrom).filter((row): row is Activity => row !== null) };
}

export async function activityTypes(account: Account, model: string | null): Promise<ActivityType[]> {
  const domain = model ? ['|', ['res_model', '=', false], ['res_model', '=', model]] : [['res_model', '=', false]];
  const rows = await rpc<Record<string, unknown>[]>(account, 'mail.activity.type', 'search_read', [domain], {
    fields: ['name', 'category', 'summary', 'delay_count', 'delay_unit', 'suggested_next_type_ids'],
    order: 'sequence, id',
  });
  return rows
    .filter((row) => typeof row.id === 'number')
    .map((row) => ({
      id: row.id as number,
      name: text(row.name),
      category: text(row.category) || 'default',
      summary: text(row.summary),
      delayCount: count(row.delay_count),
      delayUnit: text(row.delay_unit) || 'days',
      suggested: Array.isArray(row.suggested_next_type_ids) ? (row.suggested_next_type_ids as unknown[]).filter((id): id is number => typeof id === 'number') : [],
    }));
}

export async function people(account: Account, query: string): Promise<Person[]> {
  const rows = await rpc<unknown[]>(account, 'res.users', 'name_search', [], { name: query, domain: [['share', '=', false]], limit: 20 });
  return rows.map(pair).filter((row): row is [number, string] => row !== null).map(([id, name]) => ({ id, name }));
}

export function markDone(account: Account, id: number, feedback: string, attachmentIds: number[] = []) {
  return rpc<unknown>(account, 'mail.activity', 'action_feedback', [[id]], { feedback: feedback.trim() || false, attachment_ids: attachmentIds });
}

export type NextStep = { resModel: string; resId: number; previousTypeId: number | null } | null;

export async function markDoneAndNext(account: Account, activity: Activity, feedback: string): Promise<NextStep> {
  const action = await rpc<unknown>(account, 'mail.activity', 'action_feedback_schedule_next', [[activity.id]], { feedback: feedback.trim() || false });
  if (!action || typeof action !== 'object') return null;
  return { resModel: activity.resModel, resId: activity.resId, previousTypeId: activity.typeId };
}

export type Snooze = 'today' | 'tomorrow' | 'nextweek';

export function snoozeDay(when: Snooze, today: Date): string {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (when === 'tomorrow') day.setDate(day.getDate() + 1);
  if (when === 'nextweek') day.setDate(day.getDate() + 7 - ((day.getDay() + 6) % 7));
  return isoDay(day);
}

export function snooze(account: Account, id: number, when: Snooze) {
  return rpc<boolean>(account, 'mail.activity', 'write', [[id], { date_deadline: snoozeDay(when, new Date()) }]);
}

export function cancel(account: Account, id: number) {
  return rpc<unknown>(account, 'mail.activity', 'action_cancel', [[id]]);
}

function values(input: ActivityInput): Record<string, unknown> {
  return {
    activity_type_id: input.typeId || false,
    summary: input.summary.trim() || false,
    note: noteHtml(input.note) || false,
    date_deadline: input.deadline,
    user_id: input.userId || false,
  };
}

export function edit(account: Account, id: number, input: ActivityInput) {
  return rpc<boolean>(account, 'mail.activity', 'write', [[id], values(input)]);
}

export function schedule(account: Account, target: { resModel: string; resId: number }, input: ActivityInput) {
  const { date_deadline, ...rest } = values(input);
  return rpc<number[]>(account, target.resModel, 'activity_schedule', [[target.resId]], { date_deadline, ...rest, automated: false });
}

export async function scheduleTodo(account: Account, input: ActivityInput): Promise<void> {
  const wizard = await rpc<number>(account, 'mail.activity.todo.create', 'create', [
    { summary: input.summary.trim() || false, note: noteHtml(input.note) || false, date_deadline: input.deadline, user_id: account.userId },
  ]);
  await rpc<unknown>(account, 'mail.activity.todo.create', 'create_todo_activity', [[wizard]]);
}

export function attach(account: Account, target: { resModel: string; resId: number }, file: { name: string; mimetype: string; base64: string }) {
  return rpc<number>(account, 'ir.attachment', 'create', [
    { name: file.name, mimetype: file.mimetype, datas: file.base64, res_model: target.resModel, res_id: target.resId },
  ]);
}
