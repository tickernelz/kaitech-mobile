import { rpc } from '../../api/odoo';
import type { Account } from '../../auth/oauth';

type Named = { id: number; name: string };

export type RecordingCard = {
  id: number;
  name: string;
  engagement: Named;
  meeting: Named & { start: string | false };
  department: Named | false;
  state: string;
  stateLabel: string;
  sourceLabel: string;
  isDocument: boolean;
  hasDocument: boolean;
  filename: string;
  sizeLabel: string;
  uploadedBy: string;
  uploadedAt: string | false;
  isUploader: boolean;
  failureNote: string;
  larkUrl: string | false;
  clientDepartments: Named[];
  transcription: { hasMedia: boolean; reviewed: boolean; job: { state: string }; comparison: { state: string } };
};

export type MeetingRecordings = {
  recordings: RecordingCard[];
  total: number;
  canChange: boolean;
  isClient: boolean;
  departmentsByProgramme: Record<string, Named[]>;
  clientDepartmentsByProgramme: Record<string, Named[]>;
};

export type HistoryLine = { id: number; date: string; author: string; body: string; changes: string[] };

type RawMessage = { id: number; date: string; author_id: { display_name: string } | false; body: string | false; tracking_value_ids: { field_id?: { display_name: string } | false; old_value?: unknown; new_value?: unknown }[] };

const plain = (html: string) => html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

export async function recordingHistory(account: Account, recording: number): Promise<HistoryLine[]> {
  const page = await rpc<{ records: RawMessage[] }>(account, 'mail.message', 'web_search_read', [], {
    domain: [['model', '=', 'ck.mom.recording'], ['res_id', '=', recording]],
    specification: { date: {}, author_id: { fields: { display_name: {} } }, body: {}, tracking_value_ids: { fields: { field_id: { fields: { display_name: {} } }, old_value: {}, new_value: {} } } },
    order: 'date desc, id desc',
    limit: 100,
  });
  return page.records.map((row) => ({
    id: row.id,
    date: row.date,
    author: row.author_id ? row.author_id.display_name : '',
    body: plain(row.body || ''),
    changes: row.tracking_value_ids.map((one) => `${one.field_id ? one.field_id.display_name : ''}: ${String(one.old_value ?? '')} → ${String(one.new_value ?? '')}`),
  }));
}

export type StatusItem = {
  id: number;
  title: string;
  programme: string;
  meeting: string;
  status: string;
  steps: string[];
  failures: { step: string; note: string }[];
};

export type ProcessingSummary = { processing: number; failed: number; working: StatusItem[]; failing: StatusItem[] };

export type RecordKind = 'recordings' | 'minutes' | 'removals';

export type RecordLine = { id: number; title: string; detail: string; state: string; meetingId: number | false };

export type RecordPage = { lines: RecordLine[]; total: number; states: { key: string; label: string }[] };

export function meetingRecordings(account: Account, meeting: number): Promise<MeetingRecordings> {
  return rpc<MeetingRecordings>(account, 'ck.mom.recording', 'board', [], { meeting_id: meeting, limit: 50 });
}

export function processingSummary(account: Account): Promise<ProcessingSummary> {
  return rpc<ProcessingSummary>(account, 'ck.mom.recording', 'processing_summary', []);
}

export async function meetingOfRecording(account: Account, recording: number): Promise<number | null> {
  const rows = await rpc<{ meeting_id: number | false }[]>(account, 'ck.mom.recording', 'web_read', [[recording]], { specification: { meeting_id: {} } });
  return rows[0]?.meeting_id || null;
}

export type LarkImport = {
  programme: number;
  url: string;
  title: string;
  meeting: { id: number } | { name: string; heldOn: string };
  consentNote?: string;
};

export function importLark(account: Account, lark: LarkImport): Promise<RecordingCard> {
  return rpc<RecordingCard>(account, 'ck.mom.recording', 'import_lark_minutes', [
    {
      engagement_id: lark.programme,
      url: lark.url.trim(),
      title: lark.title.trim(),
      department_id: false,
      ...('id' in lark.meeting ? { meeting_id: lark.meeting.id } : { new_meeting: { name: lark.meeting.name, held_on: lark.meeting.heldOn } }),
      consent_note: lark.consentNote ?? '',
    },
  ]);
}

export function setClientDepartments(account: Account, recording: number, departments: number[]): Promise<unknown> {
  return rpc(account, 'ck.mom.recording', 'set_client_departments', [[recording], departments]);
}

export function fileUnderDepartment(account: Account, recording: number, department: number | false): Promise<unknown> {
  return rpc(account, 'ck.mom.recording', 'file_under_department', [[recording], department]);
}

export function transcribe(account: Account, recording: number): Promise<unknown> {
  return rpc(account, 'ck.mom.recording', 'transcribe', [[recording]]);
}

export function compareWithElevenLabs(account: Account, recording: number): Promise<unknown> {
  return rpc(account, 'ck.mom.recording', 'compare_with_elevenlabs', [[recording]]);
}

type Many2one = { id: number; display_name: string } | false;

const named = { fields: { display_name: {} } };

const listed: Record<RecordKind, { model: string; specification: Record<string, unknown>; order: string; search: string[] }> = {
  recordings: {
    model: 'ck.mom.recording',
    specification: { name: {}, engagement_id: named, meeting_id: named, department_id: named, state: {}, size_label: {}, uploaded_by_id: named },
    order: 'create_date desc, id desc',
    search: ['name', 'meeting_id.name', 'filename', 'department_id.name'],
  },
  minutes: {
    model: 'ck.mom.document',
    specification: { meeting_id: named, engagement_id: named, version: {}, state: {} },
    order: 'id desc',
    search: ['meeting_id.name', 'engagement_id.name'],
  },
  removals: {
    model: 'ck.mom.removal',
    specification: { create_date: {}, user_id: named, title: {}, engagement_id: named, meeting_id: named, outcome: {}, reason: {} },
    order: 'create_date desc, id desc',
    search: ['title', 'meeting_id.name', 'reason'],
  },
};

type Raw = {
  id: number;
  name?: string;
  title?: string;
  engagement_id?: Many2one;
  meeting_id?: Many2one;
  department_id?: Many2one;
  uploaded_by_id?: Many2one;
  user_id?: Many2one;
  size_label?: string;
  version?: number;
  state?: string;
  outcome?: string;
  reason?: string | false;
  create_date?: string;
};

const label = (value: Many2one | undefined) => (value ? value.display_name : '');

function lineOf(kind: RecordKind, row: Raw): RecordLine {
  const meetingId = row.meeting_id ? row.meeting_id.id : false;
  if (kind === 'recordings') {
    return { id: row.id, title: row.name ?? '', detail: [label(row.meeting_id), label(row.department_id), label(row.engagement_id), row.size_label, label(row.uploaded_by_id)].filter(Boolean).join(' · '), state: row.state ?? '', meetingId };
  }
  if (kind === 'minutes') {
    return { id: row.id, title: label(row.meeting_id), detail: [label(row.engagement_id), row.version ? `v${row.version}` : ''].filter(Boolean).join(' · '), state: row.state ?? '', meetingId };
  }
  return { id: row.id, title: row.title ?? '', detail: [label(row.user_id), label(row.meeting_id), row.reason || ''].filter(Boolean).join(' · '), state: row.outcome ?? '', meetingId };
}

export function searchDomain(fields: string[], said: string): unknown[] {
  return [...fields.slice(1).map(() => '|'), ...fields.map((field) => [field, 'ilike', said])];
}

type Views = { models: Record<string, { fields: Record<string, { selection?: [string, string][] }> }> };

async function stateLabels(account: Account, model: string, field: string): Promise<Map<string, string>> {
  const views = await rpc<Views>(account, model, 'get_views', [[[false, 'list']]], {});
  return new Map(views.models[model]?.fields[field]?.selection ?? []);
}

export async function recordPage(account: Account, kind: RecordKind, search: string, limit: number, state = ''): Promise<RecordPage> {
  const shape = listed[kind];
  const said = search.trim();
  const field = kind === 'removals' ? 'outcome' : 'state';
  const domain = [...(said ? searchDomain(shape.search, said) : []), ...(state ? [[field, '=', state]] : [])];
  const [page, labels] = await Promise.all([
    rpc<{ length: number; records: Raw[] }>(account, shape.model, 'web_search_read', [], {
      domain,
      specification: shape.specification,
      offset: 0,
      limit,
      order: shape.order,
      count_limit: 10001,
    }),
    stateLabels(account, shape.model, field),
  ]);
  return {
    states: [...labels].map(([key, label]) => ({ key, label })),
    lines: page.records.map((row) => {
      const line = lineOf(kind, row);
      return { ...line, state: labels.get(line.state) ?? line.state };
    }),
    total: page.length,
  };
}
