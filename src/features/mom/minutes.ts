import { rpc } from '../../api/odoo';
import type { Account } from '../../auth/oauth';
import type { Detail, Item } from './api';

export type MinutesPart = 'document' | 'dynamics' | 'milestones' | 'context';

export function generateMinutes(account: Account, meeting: number): Promise<unknown> {
  return rpc(account, 'ck.mom.document', 'generate_minutes', [false, meeting]);
}

export function decideHint(account: Account, hint: number, confirm: boolean): Promise<unknown> {
  return rpc(account, 'ck.mom.milestone.hint', confirm ? 'action_confirm' : 'action_dismiss', [[hint]]);
}

const live = ['queued', 'running', 'retrying'];

export function isGenerating(detail: Pick<Detail, 'job'>): boolean {
  return live.includes(detail.job?.state ?? '');
}

export function whyNot(detail: Pick<Detail, 'why_not'>): string[] {
  return (detail.why_not ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export const itemFilters = ['awaiting', 'attention', 'APPROVED', 'REJECTED', 'all'] as const;
export type ItemFilter = (typeof itemFilters)[number];

export function filterItems(items: Item[], filter: ItemFilter, type: string): Item[] {
  return items.filter((item) => {
    if (type && item.type !== type) return false;
    if (filter === 'awaiting') return !item.decided;
    if (filter === 'attention') return item.status === 'NEEDS_HUMAN_REVIEW' || item.status === 'CONFLICT';
    if (filter === 'all') return true;
    return item.status === filter;
  });
}

export function itemTypes(items: Item[]): { type: string; label: string; count: number }[] {
  const seen = new Map<string, { type: string; label: string; count: number }>();
  for (const item of items) {
    const known = seen.get(item.type);
    if (known) known.count += 1;
    else seen.set(item.type, { type: item.type, label: item.typeLabel || item.type, count: 1 });
  }
  return [...seen.values()];
}

export type Block = { title: string; lines: string[] };

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '');
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const joined = (...parts: unknown[]) => parts.map(text).filter(Boolean).join(' · ');

export function documentBlocks(minutes: Record<string, unknown> | undefined, label: (key: string) => string): Block[] {
  const doc = record(minutes);
  const board = record(doc.direksi);
  const summary = record(board.executiveSummary);
  const next = record(board.nextMeeting);
  const blocks: Block[] = [
    {
      title: label('about'),
      lines: [
        joined(doc.projectTitle, doc.sessionTitle),
        joined(doc.meetingDate, doc.location),
        text(doc.topic),
        list(doc.participants).map(text).filter(Boolean).join(', '),
        text(doc.noteTaker) ? `${label('noteTaker')}: ${text(doc.noteTaker)}` : '',
        joined(board.meetingType, board.meetingLeader),
      ].filter(Boolean),
    },
    { title: label('status'), lines: [text(summary.statusRingkas), text(summary.statusNarasi)].filter(Boolean) },
    { title: label('positives'), lines: list(summary.hasilPositif).map(text).filter(Boolean) },
    { title: label('keyDecisions'), lines: list(summary.keputusanPenting).map(text).filter(Boolean) },
    { title: label('needsHelp'), lines: list(summary.butuhBantuan).map(text).filter(Boolean) },
    { title: label('discussion'), lines: list(doc.pembahasanUtama).map(text).filter(Boolean) },
    {
      title: label('points'),
      lines: list(doc.butirPembahasan).map((one) => {
        const point = record(one);
        const head = joined(point.kode, point.judul, point.bagian, point.status);
        const body = [...list(point.uraian), ...list(point.caraMengecek).map((step) => `✓ ${text(step)}`)].map(text).filter(Boolean);
        return [head, ...body].join('\n');
      }),
    },
    {
      title: label('actionMatrix'),
      lines: list(board.actionMatrix).map((one) => {
        const row = record(one);
        return [joined(row.actId, row.actionItem), joined(row.pembahasan, row.urgensi), joined(row.pic, row.deadline, row.statusFollowUp), text(row.detail), text(row.catatan)]
          .filter(Boolean)
          .join('\n');
      }),
    },
    { title: label('decisions'), lines: list(doc.keputusan).map(text).filter(Boolean) },
    {
      title: label('actions'),
      lines: list(doc.actionItems).map((one) => {
        const row = record(one);
        return [text(row.task), joined(row.owner, row.due, row.status)].filter(Boolean).join('\n');
      }),
    },
    {
      title: label('requirements'),
      lines: list(doc.requirementItems).map((one) => {
        const row = record(one);
        return [text(row.item), joined(row.pic, row.area, row.prioritas, row.status)].filter(Boolean).join('\n');
      }),
    },
    { title: label('confirm'), lines: list(doc.konfirmasiLanjutan).map(text).filter(Boolean) },
    { title: label('notes'), lines: list(doc.catatanTambahan).map(text).filter(Boolean) },
    {
      title: label('programme'),
      lines: list(doc.konteksProgram).map((one) => {
        const row = record(one);
        return [text(row.isi), text(row.sumber)].filter(Boolean).join('\n');
      }),
    },
    {
      title: label('attendance'),
      lines: list(board.attendance).map((one) => {
        const row = record(one);
        return joined(row.name, row.jabatan, row.organization, row.statusKehadiran);
      }),
    },
    {
      title: label('nextMeeting'),
      lines: [joined(next.tanggal, next.waktu, next.lokasi), ...list(next.agenda).map(text)].filter(Boolean),
    },
  ];
  return blocks.filter((block) => block.lines.length);
}

export function dynamicsBlocks(dynamics: Record<string, unknown> | undefined, label: (key: string) => string): Block[] {
  const data = record(dynamics);
  const blocks: Block[] = [
    { title: label('summary'), lines: [text(data.summary)].filter(Boolean) },
    { title: label('dominance'), lines: [text(data.dominasi_diskusi)].filter(Boolean) },
    { title: label('sentiment'), lines: [text(data.sentiment)].filter(Boolean) },
    {
      title: label('speakers'),
      lines: list(data.speakers).map((one) => {
        const row = record(one);
        return [joined(row.speakerLabel, row.role, row.talkTimeEstimate), text(row.observation)].filter(Boolean).join('\n');
      }),
    },
    { title: label('observations'), lines: list(data.observations).map(text).filter(Boolean) },
    { title: label('blockers'), lines: list(data.blockers).map(text).filter(Boolean) },
  ];
  return blocks.filter((block) => block.lines.length);
}

export function contextBlocks(context: Record<string, unknown> | undefined, label: (key: string) => string): Block[] {
  const data = record(context);
  const names = (value: unknown) =>
    list(value)
      .map((one) => (typeof one === 'string' ? one : joined(record(one).name ?? record(one).title, record(one).term ?? record(one).role)))
      .filter(Boolean);
  const blocks: Block[] = [
    { title: label('recordings'), lines: names(data.recordings) },
    { title: label('prompt'), lines: [text(data.prompt) === 'custom' ? label('promptCustom') : label('promptDefault')] },
    { title: label('authorities'), lines: names(data.authorities) },
    { title: label('glossary'), lines: names(data.glossaryTerms) },
    { title: label('milestones'), lines: names(data.milestones) },
    { title: label('notes'), lines: names(data.notes) },
    { title: label('documents'), lines: names(data.documents) },
    {
      title: label('size'),
      lines: [
        text(data.knowledgeMode),
        text(data.transcriptChars) ? `${label('transcriptChars')}: ${text(data.transcriptChars)}` : '',
        text(data.noteChars) ? `${label('noteChars')}: ${text(data.noteChars)}` : '',
      ].filter(Boolean),
    },
  ];
  return blocks.filter((block) => block.lines.length);
}
