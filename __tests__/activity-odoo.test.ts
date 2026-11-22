import type { Account } from '../src/auth/oauth';
import { dueOf } from '../src/features/activity/due';
import { monthCells, offersDaily, orderedTypes } from '../src/features/activity/rules';
import {
  activityFrom,
  byModel,
  defaultDeadline,
  groupsFrom,
  markDone,
  markDoneAndNext,
  noteHtml,
  overview,
  pendingCount,
  plainNote,
  schedule,
  snoozeDay,
  type Activity,
} from '../src/features/activity/odoo';

const mockCalls: { kind: 'rpc' | 'route'; target: string; method?: string; args?: unknown[]; kwargs?: Record<string, unknown> }[] = [];
const mockAnswers: unknown[] = [];
let mockFailure: Error | null = null;

jest.mock('../src/api/odoo', () => ({
  rpc: (_account: unknown, model: string, method: string, args: unknown[] = [], kwargs: Record<string, unknown> = {}) => {
    mockCalls.push({ kind: 'rpc', target: model, method, args, kwargs });
    return mockFailure ? Promise.reject(mockFailure) : Promise.resolve(mockAnswers.shift());
  },
  route: (_account: unknown, path: string, params: Record<string, unknown>) => {
    mockCalls.push({ kind: 'route', target: path, kwargs: params });
    return Promise.resolve(mockAnswers.shift());
  },
}));

const account = { id: 'a', origin: 'https://lab0.test', db: 'lab0', userId: 9, partnerId: 7, deviceId: 1, name: 'Budi', login: 'budi', signedInAt: 0 } as Account;

function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 1,
    summary: 'Call back',
    note: '<p>Ask about <b>PO</b> &amp; invoice</p><p>Line two</p>',
    activity_type_id: [2, 'Call'],
    activity_category: 'phonecall',
    date_deadline: '2026-11-20',
    state: 'overdue',
    res_model: 'crm.lead',
    res_id: 44,
    res_name: 'Big deal',
    res_model_id: [80, 'Lead/Opportunity'],
    user_id: [9, 'Budi'],
    can_write: true,
    ...over,
  };
}

beforeEach(() => {
  mockCalls.length = 0;
  mockAnswers.length = 0;
});

describe('activity rows', () => {
  it('reads an Odoo activity row into what the list shows', () => {
    const activity = activityFrom(row()) as Activity;
    expect(activity).toMatchObject({ id: 1, typeName: 'Call', category: 'phonecall', state: 'overdue', resModel: 'crm.lead', resId: 44, modelName: 'Lead/Opportunity', userId: 9, canWrite: true });
    expect(activity.note).toBe('Ask about PO & invoice\nLine two');
  });

  it('treats a row without write access as read-only and an unknown state as planned', () => {
    expect(activityFrom(row({ can_write: false, state: 'done' }))).toMatchObject({ canWrite: false, state: 'planned' });
  });

  it('escapes a typed note before sending it as HTML', () => {
    expect(noteHtml('a < b & c\n\nnext')).toBe('<p>a &lt; b &amp; c</p><p><br></p><p>next</p>');
    expect(plainNote(noteHtml('a < b & c'))).toBe('a < b & c');
    expect(noteHtml('   ')).toBe('');
  });
});

describe('systray groups', () => {
  it('separates today\'s meetings from activity groups and counts only late and today as pending', () => {
    const { groups, meetings } = groupsFrom([
      { type: 'meeting', model: 'calendar.event', meetings: [{ id: 5, name: 'Standup', start: '2026-11-22 02:00:00', allday: false }] },
      { model: 'crm.lead', name: 'Lead', overdue_count: 2, today_count: 1, planned_count: 4, total_count: 7 },
      { model: 'project.task', name: 'To-Do', overdue_count: 0, today_count: 1, planned_count: 0, total_count: 1 },
    ]);
    expect(meetings).toEqual([{ id: 5, name: 'Standup', start: '2026-11-22 02:00:00', allDay: false }]);
    expect(groups.map((group) => group.model)).toEqual(['crm.lead', 'project.task']);
    expect(pendingCount(groups)).toBe(4);
  });

  it('groups activities by record model in systray order and names a model split in two groups by both', () => {
    const activities = [
      activityFrom(row({ id: 1, res_model: 'project.task', res_model_id: [3, 'Task'] })),
      activityFrom(row({ id: 2 })),
      activityFrom(row({ id: 3, res_model: 'project.task', res_model_id: [3, 'Task'] })),
    ] as Activity[];
    const groups = groupsFrom([
      { model: 'crm.lead', name: 'Lead' },
      { model: 'project.task', name: 'To-Do' },
      { model: 'project.task', name: 'Task' },
    ]).groups;
    const sections = byModel(activities, groups);
    expect(sections.map((section) => [section.title, section.data.map((activity) => activity.id)])).toEqual([
      ['Lead', [2]],
      ['To-Do · Task', [1, 3]],
    ]);
  });
});

describe('dates', () => {
  const today = new Date(2026, 10, 22, 15, 30);

  it('labels a deadline relative to today', () => {
    expect(dueOf('2026-11-19', today)).toEqual({ key: 'overdue', count: 3 });
    expect(dueOf('2026-11-21', today)).toEqual({ key: 'yesterday', count: 1 });
    expect(dueOf('2026-11-22', today)).toEqual({ key: 'today', count: 0 });
    expect(dueOf('2026-11-23', today)).toEqual({ key: 'tomorrow', count: 1 });
    expect(dueOf('2026-11-27', today)).toEqual({ key: 'inDays', count: 5 });
    expect(dueOf('2026-12-05', today)?.key).toBe('on');
    expect(dueOf('', today)).toBeNull();
  });

  it('reschedules on the phone\'s own day, with next week on Monday like the web', () => {
    expect(snoozeDay('today', today)).toBe('2026-11-22');
    expect(snoozeDay('tomorrow', today)).toBe('2026-11-23');
    expect(snoozeDay('nextweek', today)).toBe('2026-11-23');
    expect(snoozeDay('nextweek', new Date(2026, 10, 23, 9))).toBe('2026-11-30');
    expect(snoozeDay('nextweek', new Date(2026, 10, 28, 9))).toBe('2026-11-30');
  });

  it('proposes the deadline the activity type plans', () => {
    const type = (delayCount: number, delayUnit: string) => ({ id: 1, name: '', category: '', summary: '', delayCount, delayUnit, suggested: [] });
    expect(defaultDeadline(undefined, today)).toBe('2026-11-22');
    expect(defaultDeadline(type(3, 'days'), today)).toBe('2026-11-25');
    expect(defaultDeadline(type(2, 'weeks'), today)).toBe('2026-12-06');
    expect(defaultDeadline(type(1, 'months'), today)).toBe('2026-12-22');
  });

  it('lays a month out from the locale\'s first weekday', () => {
    const monday = monthCells(2026, 10, 1);
    const sunday = monthCells(2026, 10, 0);
    expect(monday.findIndex(Boolean)).toBe(6);
    expect(sunday.findIndex(Boolean)).toBe(0);
    expect(monday.length % 7).toBe(0);
    expect(monday.filter(Boolean)).toHaveLength(30);
  });
});

describe('choices', () => {
  it('offers the types the previous one suggests first', () => {
    const types = [1, 2, 3].map((id) => ({ id, name: String(id), category: '', summary: '', delayCount: 0, delayUnit: 'days', suggested: id === 1 ? [3] : [] }));
    expect(orderedTypes(types, 1).map((type) => type.id)).toEqual([3, 1, 2]);
    expect(orderedTypes(types, null).map((type) => type.id)).toEqual([1, 2, 3]);
  });

  it('offers the daily message toggle only where a channel can carry it', () => {
    expect(offersDaily({ on: false, channel: '', reaches: false })).toBeNull();
    expect(offersDaily({ on: false, channel: 'WhatsApp', reaches: false })).toBe('link');
    expect(offersDaily({ on: false, channel: 'WhatsApp', reaches: true })).toBe('toggle');
    expect(offersDaily({ on: true, channel: 'WhatsApp', reaches: false })).toBe('toggle');
  });
});

describe('empty and refused answers', () => {
  it('shows no activities and no meetings when the user has none', async () => {
    mockAnswers.push({ Store: {} }, []);
    expect(await overview(account)).toEqual({ groups: [], meetings: [], activities: [] });
    expect(groupsFrom(undefined)).toEqual({ groups: [], meetings: [] });
    expect(pendingCount([])).toBe(0);
    expect(byModel([], [])).toEqual([]);
  });

  it('skips rows the server answers without an id or a record model', () => {
    expect(activityFrom({ summary: 'x', res_model: 'crm.lead' })).toBeNull();
    expect(activityFrom({ id: 3 })).toBeNull();
  });

  it('passes a server refusal through to the screen instead of swallowing it', async () => {
    mockFailure = new Error('forbidden');
    await expect(overview(account)).rejects.toThrow('forbidden');
    await expect(markDone(account, 1, '')).rejects.toThrow('forbidden');
    mockFailure = null;
  });
});

describe('server calls', () => {
  it('reads only the signed-in user\'s activities and the web systray groups', async () => {
    mockAnswers.push({ Store: { activityGroups: [{ model: 'crm.lead', name: 'Lead', overdue_count: 1 }] } }, [row()]);
    const result = await overview(account);
    expect(mockCalls[0]).toMatchObject({ kind: 'route', target: '/mail/data', kwargs: { fetch_params: ['systray_get_activities'] } });
    expect(mockCalls[1]).toMatchObject({ kind: 'rpc', target: 'mail.activity', method: 'search_read', args: [[['user_id', '=', 9]]] });
    expect(result.groups).toHaveLength(1);
    expect(result.activities.map((activity) => activity.id)).toEqual([1]);
  });

  it('schedules on the record as a manual activity, like the web form', async () => {
    mockAnswers.push([12]);
    await schedule(account, { resModel: 'crm.lead', resId: 44 }, { typeId: 2, summary: ' Follow up ', note: 'x', deadline: '2026-11-30', userId: 9 });
    expect(mockCalls[0]).toMatchObject({
      target: 'crm.lead',
      method: 'activity_schedule',
      args: [[44]],
      kwargs: { date_deadline: '2026-11-30', activity_type_id: 2, summary: 'Follow up', note: '<p>x</p>', user_id: 9, automated: false },
    });
  });

  it('asks for the next activity only when the server did not chain one itself', async () => {
    const activity = activityFrom(row()) as Activity;
    mockAnswers.push({ type: 'ir.actions.act_window' });
    expect(await markDoneAndNext(account, activity, '')).toEqual({ resModel: 'crm.lead', resId: 44, previousTypeId: 2 });
    mockAnswers.push(false);
    expect(await markDoneAndNext(account, activity, 'ok')).toBeNull();
    expect(mockCalls[1].kwargs).toMatchObject({ feedback: 'ok' });
  });
});
