import { createElement } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { readBlock, splitBlocks, TABLE_ROWS } from '../src/features/discovery/blocks';
import { Markdown } from '../src/features/discovery/Markdown';
import '../src/i18n';

jest.mock('expo-sqlite/kv-store', () => ({
  getItemSync: () => null,
  setItemSync: () => undefined,
  removeItemSync: () => undefined,
}));

const replies = JSON.stringify({
  type: 'replies',
  summary: 'Pilihan cepat untuk memutuskan pertanyaan untuk Pak/Bu Abdi.',
  replies: ['Ambil pertanyaan untuk Abdi ke bank', 'Pertanyaan itu tidak perlu', 'Saya rekam ulang pesan suaranya'],
  sources: [{ label: 'Agenda program', ref: 'ck.question,28' }],
});

function fenced(raw: string) {
  return `Ada satu hal yang perlu Bapak putuskan.\n\n\`\`\`kt-block\n${raw}\n\`\`\`\nSetelah itu saya lanjutkan.`;
}

describe('splitBlocks', () => {
  it('cuts a kt-block out of the prose around it', () => {
    expect(splitBlocks(fenced(replies))).toEqual([
      { kind: 'text', text: 'Ada satu hal yang perlu Bapak putuskan.\n' },
      { kind: 'block', raw: replies },
      { kind: 'text', text: 'Setelah itu saya lanjutkan.' },
    ]);
  });

  it('negative control: other code fences stay prose', () => {
    const source = 'Contoh:\n\`\`\`json\n{"type":"replies"}\n\`\`\`';
    expect(splitBlocks(source)).toEqual([{ kind: 'text', text: source }]);
  });

  it('takes an unclosed kt-block to the end of the message', () => {
    expect(splitBlocks('Teks\n\`\`\`kt-block\n{"a":1}')).toEqual([
      { kind: 'text', text: 'Teks' },
      { kind: 'block', raw: '{"a":1}' },
    ]);
  });
});

describe('readBlock', () => {
  it('reads quick replies and their sources', () => {
    expect(readBlock(replies)).toEqual({
      kind: 'replies',
      title: '',
      summary: 'Pilihan cepat untuk memutuskan pertanyaan untuk Pak/Bu Abdi.',
      sources: [{ label: 'Agenda program', ref: 'ck.question,28' }],
      replies: ['Ambil pertanyaan untuk Abdi ke bank', 'Pertanyaan itu tidak perlu', 'Saya rekam ulang pesan suaranya'],
    });
  });

  it('negative control: replies the web would refuse are not offered as buttons', () => {
    for (const bad of [[], ['a', 'a'], ['a', 'b', 'c', 'd', 'e'], ['x'.repeat(61)], [' '], [1]]) {
      const block = readBlock(JSON.stringify({ type: 'replies', summary: 'Pilih', replies: bad }));
      expect(block).toMatchObject({ kind: 'other', summary: 'Pilih', table: null });
    }
  });

  it('negative control: replies without a summary the web accepts are not offered as buttons', () => {
    const offered = ['Ya', 'Tidak'];
    expect(readBlock(JSON.stringify({ type: 'replies', replies: offered }))).toEqual({ kind: 'unreadable' });
    expect(readBlock(JSON.stringify({ type: 'replies', summary: '  ', title: 'Pilih', replies: offered }))).toMatchObject({ kind: 'other', title: 'Pilih' });
    expect(readBlock(JSON.stringify({ type: 'replies', summary: 7, title: 'Pilih', replies: offered }))).toMatchObject({ kind: 'other', title: 'Pilih' });
    expect(readBlock(JSON.stringify({ type: 'replies', summary: 's'.repeat(401), replies: offered }))).toMatchObject({ kind: 'other', table: null });
    expect(readBlock(JSON.stringify({ type: 'replies', summary: 's'.repeat(400), replies: offered }))).toMatchObject({ kind: 'replies', replies: offered });
  });

  it('shows an unknown kind by its title and summary', () => {
    expect(readBlock(JSON.stringify({ type: 'diagram', title: 'Alur PO', summary: 'Tiga langkah', nodes: 'x' }))).toEqual({
      kind: 'other',
      title: 'Alur PO',
      summary: 'Tiga langkah',
      sources: [],
      table: null,
    });
  });

  it('shows the rows of an unknown kind as a plain table', () => {
    const rows = Array.from({ length: TABLE_ROWS + 3 }, (_, index) => ({ name: `Gudang ${index}`, stock: index, meta: { a: 1 } }));
    const block = readBlock(JSON.stringify({ type: 'table_v2', summary: 'Stok', items: rows }));
    expect(block.kind).toBe('other');
    if (block.kind !== 'other' || !block.table) throw new Error('no table');
    expect(block.table.columns).toEqual(['name', 'stock', 'meta']);
    expect(block.table.rows[1]).toEqual(['Gudang 1', '1', '{"a":1}']);
    expect(block.table.rows).toHaveLength(TABLE_ROWS);
    expect(block.table.hidden).toBe(3);
  });

  it('reads columns and rows as a table', () => {
    const block = readBlock(JSON.stringify({ type: 'table', summary: 'S', columns: [{ name: 'Kode' }, { label: 'Nama' }], rows: [['A1', null]] }));
    expect(block).toMatchObject({ table: { columns: ['Kode', 'Nama'], rows: [['A1', null]], hidden: 0 } });
  });

  it('marks broken JSON, a non-object, and an empty object as unreadable', () => {
    expect(readBlock('{"type":"replies",')).toEqual({ kind: 'unreadable' });
    expect(readBlock('["a"]')).toEqual({ kind: 'unreadable' });
    expect(readBlock('{"type":"kpi"}')).toEqual({ kind: 'unreadable' });
  });

  it('drops sources without a label', () => {
    const block = readBlock(JSON.stringify({ type: 'x', summary: 's', sources: [{ ref: 'a,1' }, 'b', { label: ' ' }, { label: 'Notulen' }] }));
    expect(block).toMatchObject({ sources: [{ label: 'Notulen', ref: '' }] });
  });
});

describe('Markdown with a kt-block', () => {
  it('draws quick replies as buttons that send their text, once', async () => {
    const onReply = jest.fn();
    await render(createElement(Markdown, { text: fenced(replies), onReply }));
    expect(screen.queryByText(/"type"/)).toBeNull();
    expect(screen.getByText('Agenda program')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('kt-reply-1'));
    expect(onReply).toHaveBeenCalledWith('Pertanyaan itu tidak perlu');
    expect(screen.getByTestId('kt-reply-0')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('kt-reply-0'));
    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it('never shows the JSON of a block it cannot draw', async () => {
    await render(createElement(Markdown, { text: fenced('{"type":"chart", "x": [1,') }));
    expect(screen.getByTestId('kt-block-unreadable')).toBeTruthy();
    expect(screen.queryByText(/"type"/)).toBeNull();
    expect(screen.getByText('Setelah itu saya lanjutkan.')).toBeTruthy();
  });
});
