import type { TranscriptItem } from '../src/features/discovery/api';
import { parseServerDate } from '../src/features/discovery/dates';
import { blocksOf, spansOf } from '../src/features/discovery/Markdown';
import { routeForPush } from '../src/features/discovery/push';
import { entriesOf, mergeItems, stepCount } from '../src/features/discovery/thread';

function item(turnId: number, seq: number, kind: string, body = ''): TranscriptItem {
  return { turnId, seq, kind, author: 'coworker', name: kind, body, occurredAt: '' };
}

describe('transcript', () => {
  it('folds a turn of tool steps into one line between the question and the reply', () => {
    const entries = entriesOf([
      item(1, 0, 'request', 'Siapa yang menyetujui lembur?'),
      item(1, 1, 'tool_call'),
      item(1, 2, 'tool_result'),
      item(1, 3, 'tool_call'),
      item(1, 4, 'tool_result'),
      item(1, 5, 'message', 'Dua narasumber berbeda.'),
      item(2, 0, 'request', 'Lanjut'),
      item(2, 1, 'failure'),
    ]);
    expect(entries.map((entry) => entry.kind)).toEqual(['request', 'steps', 'reply', 'request', 'failure']);
    const steps = entries[1];
    expect(steps.kind === 'steps' && stepCount(steps.steps)).toBe(2);
  });

  it('keeps steps of different turns apart and hides empty messages', () => {
    const entries = entriesOf([item(1, 1, 'tool_call'), item(2, 1, 'tool_call'), item(2, 2, 'message', '  ')]);
    expect(entries.map((entry) => entry.kind)).toEqual(['steps', 'steps']);
  });

  it('merges a later page without repeating what was already shown', () => {
    const merged = mergeItems([item(1, 0, 'request'), item(1, 1, 'tool_call')], [item(1, 1, 'tool_call'), item(1, 2, 'message', 'ok')]);
    expect(merged.map((entry) => `${entry.turnId}:${entry.seq}`)).toEqual(['1:0', '1:1', '1:2']);
  });
});

describe('routeForPush', () => {
  it('opens a restated card straight from its notification', () => {
    expect(routeForPush({ type: 'discovery_card_restated', res_id: '41', engagement_id: '7', conversation_id: '12', instruction_id: '9' })).toEqual({
      pathname: '/program/card/[id]',
      params: { id: '41', programme: '7', conversation: '12' },
    });
  });

  it('opens the conversation of a Coworker answer', () => {
    expect(routeForPush({ type: 'discovery_answer', res_id: 12, engagement_id: 7, turn_id: 30 })).toEqual({
      pathname: '/program/[id]/coworker',
      params: { id: '7', conversation: '12' },
    });
  });

  it('opens the minutes of a meeting', () => {
    expect(routeForPush({ type: 'mom_minutes', res_id: 3, engagement_id: 7, meeting_id: '15' })).toEqual({
      pathname: '/mom/[meeting]',
      params: { meeting: '15' },
    });
  });

  it('ignores other kinds and malformed ids', () => {
    expect(routeForPush({ type: 'mom_minutes', res_id: 3, engagement_id: 7 })).toBeNull();
    expect(routeForPush({ type: 'discovery_card', res_id: 'x', engagement_id: 7 })).toBeNull();
  });
});

describe('Markdown', () => {
  it('reads bullets, headings and paragraphs the Coworker writes', () => {
    expect(blocksOf('Dua jawaban:\n- **Budi**: cukup kasi.\n- Dewi: manajer.\n\nAturan belum ada\ndi sumber.')).toEqual([
      { kind: 'paragraph', text: 'Dua jawaban:' },
      { kind: 'bullet', text: '**Budi**: cukup kasi.' },
      { kind: 'bullet', text: 'Dewi: manajer.' },
      { kind: 'paragraph', text: 'Aturan belum ada\ndi sumber.' },
    ]);
    expect(spansOf('**Budi**: cukup')).toEqual([
      { text: 'Budi', strong: true },
      { text: ': cukup', strong: false },
    ]);
  });
});

describe('parseServerDate', () => {
  it('reads Odoo UTC timestamps', () => {
    expect(parseServerDate('2026-11-20 01:02:03')?.toISOString()).toBe('2026-11-20T01:02:03.000Z');
    expect(parseServerDate(false)).toBeNull();
  });
});
