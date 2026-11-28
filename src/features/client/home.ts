export type MinutesState = 'arriving' | 'open' | 'corrected' | 'approved';

export type Interview = { inviteId: number; questionsLeft: number; expiresOn: string };
export type DocumentAsk = { requestId: number; document: string; why: string; handedOver: string; unreadable: boolean; handedOverOn: string };
export type DataAsk = { grantId: number; name: string; purpose: string; columns: string };
export type Minutes = { meetingId: number; subject: string; heldOn: string; number: string; state: MinutesState; correctionsUntil: string; hasFile: boolean };
export type Todo = { actionId: number; name: string; due: string; late: boolean; meeting: string; reportedOn: string; sentBack: boolean };
export type Waiting = { person: string; total: number };

export type ProgrammeBlock = {
  engagementId: number;
  programme: string;
  stage: string;
  interviews: Interview[];
  documents: DocumentAsk[];
  data: DataAsk[];
  minutes: Minutes[];
  todos: Todo[];
  published: number;
  team: Waiting[];
};

type Raw = Record<string, unknown>;

const minutesStates: readonly MinutesState[] = ['arriving', 'open', 'corrected', 'approved'];

function isRecord(value: unknown): value is Raw {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function id(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function rows<T>(value: unknown, read: (row: Raw) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map(read).filter((row): row is T => row !== null);
}

function interview(row: Raw): Interview | null {
  const inviteId = id(row.invite_id);
  return inviteId ? { inviteId, questionsLeft: count(row.questions_left), expiresOn: text(row.expires_on) } : null;
}

function documentAsk(row: Raw): DocumentAsk | null {
  const requestId = id(row.request_id);
  if (!requestId) return null;
  return {
    requestId,
    document: text(row.document),
    why: text(row.why),
    handedOver: text(row.handed_over),
    unreadable: row.handed_over_unreadable === true,
    handedOverOn: text(row.handed_over_on),
  };
}

function dataAsk(row: Raw): DataAsk | null {
  const grantId = id(row.grant_id);
  return grantId ? { grantId, name: text(row.name), purpose: text(row.purpose), columns: text(row.columns) } : null;
}

function minutes(row: Raw): Minutes | null {
  const meetingId = id(row.meeting_id);
  const state = minutesStates.find((one) => one === row.state);
  if (!meetingId || !state) return null;
  return {
    meetingId,
    subject: text(row.subject),
    heldOn: text(row.held_on),
    number: text(row.number),
    state,
    correctionsUntil: text(row.corrections_until),
    hasFile: text(row.download).length > 0,
  };
}

function todo(row: Raw): Todo | null {
  const actionId = id(row.action_id);
  if (!actionId) return null;
  return {
    actionId,
    name: text(row.name),
    due: text(row.due),
    late: row.late === true,
    meeting: text(row.meeting),
    reportedOn: text(row.reported_on),
    sentBack: row.sent_back === true,
  };
}

function waiting(row: Raw): Waiting | null {
  const person = text(row.person);
  const total = isRecord(row.waiting) ? count(row.waiting.total) : 0;
  return person && total ? { person, total } : null;
}

function block(row: Raw): ProgrammeBlock | null {
  const engagementId = id(row.engagement_id);
  if (!engagementId) return null;
  return {
    engagementId,
    programme: text(row.programme),
    stage: text(row.stage),
    interviews: rows(row.interviews, interview),
    documents: rows(row.documents, documentAsk),
    data: rows(row.data, dataAsk),
    minutes: rows(row.minutes, minutes),
    todos: rows(row.todos, todo),
    published: count(row.published),
    team: rows(row.team, waiting),
  };
}

export function homeFrom(body: unknown): ProgrammeBlock[] {
  if (!isRecord(body) || !Array.isArray(body.programmes)) throw new Error('home_invalid');
  return rows(body.programmes, block);
}

export function isQuiet(programme: ProgrammeBlock): boolean {
  return !programme.interviews.length && !programme.documents.length && !programme.data.length && !programme.minutes.length && !programme.todos.length;
}

export function documentWaits(ask: DocumentAsk): boolean {
  return !ask.handedOverOn || ask.unreadable;
}

export function todoWaits(item: Todo): boolean {
  return !item.reportedOn;
}

export function dayLabel(iso: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return '';
  const moment = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(moment);
}
