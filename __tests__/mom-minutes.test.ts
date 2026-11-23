import type { Item } from '../src/features/mom/api';
import { documentBlocks, filterItems, whyNot } from '../src/features/mom/minutes';

jest.mock('../src/api/odoo', () => ({ rpc: jest.fn() }));

const item = (id: number, type: string, status: string, decided: boolean): Item =>
  ({ id, type, typeLabel: type, title: `t${id}`, description: '', quote: '', at: '', speaker: '', status, statusLabel: status, decided }) as Item;

const items = [item(1, 'DECISION', 'APPROVED', true), item(2, 'RISK', 'NEEDS_HUMAN_REVIEW', false), item(3, 'RISK', 'CONFLICT', false), item(4, 'ISSUE', 'REJECTED', true)];

describe('knowledge filters follow the web', () => {
  it('splits waiting, attention, approved and rejected, and narrows by type', () => {
    const ids = (list: Item[]) => list.map((one) => one.id);
    expect(ids(filterItems(items, 'awaiting', ''))).toEqual([2, 3]);
    expect(ids(filterItems(items, 'attention', ''))).toEqual([2, 3]);
    expect(ids(filterItems(items, 'APPROVED', ''))).toEqual([1]);
    expect(ids(filterItems(items, 'REJECTED', ''))).toEqual([4]);
    expect(ids(filterItems(items, 'all', 'RISK'))).toEqual([2, 3]);
  });
});

describe('minutes text', () => {
  it('reads every refusal reason on its own line', () => {
    expect(whyNot({ why_not: 'No transcript yet.\n\n Budget spent. ' })).toEqual(['No transcript yet.', 'Budget spent.']);
    expect(whyNot({})).toEqual([]);
  });

  it('keeps only the parts of the minutes that hold something', () => {
    const blocks = documentBlocks(
      { keputusan: ['Go live in March'], actionItems: [{ task: 'Send prices', owner: 'Ani', due: '2026-12-01' }], pembahasanUtama: [], direksi: { executiveSummary: { hasilPositif: [] } } },
      (key) => key,
    );
    expect(blocks).toEqual([
      { title: 'decisions', lines: ['Go live in March'] },
      { title: 'actions', lines: ['Send prices\nAni · 2026-12-01'] },
    ]);
  });
});
