import { composeBody } from '../src/features/chat/html';
import { bodyBlocks, bodyPreview, markdownOfHtml, parseMarkdown, sourceBlocks, type MdBlock } from '../src/features/chat/markdown';
import { applyMarkup } from '../src/features/chat/markup';

function only(blocks: MdBlock[]) {
  expect(blocks).toHaveLength(1);
  return blocks[0];
}

function spansOf(source: string, tables = false) {
  const block = only(parseMarkdown(source, { tables }));
  if (block.kind !== 'text') throw new Error(`expected text, got ${block.kind}`);
  return block.spans;
}

describe('markdown inline', () => {
  it('renders the chat format set', () => {
    expect(spansOf('**tebal** _miring_ *miring* ~~coret~~ `kode`')).toEqual([
      { text: 'tebal', bold: true },
      { text: ' ' },
      { text: 'miring', italic: true },
      { text: ' ' },
      { text: 'miring', italic: true },
      { text: ' ' },
      { text: 'coret', strike: true },
      { text: ' ' },
      { text: 'kode', code: true },
    ]);
  });

  it.each(['snake_case_nama', '2*3*4', 'harga 5 * 3 = 15', '__init__.py', 'file_a_b.txt dan *', 'a ** b', 'kata_ lain_kata'])(
    'leaves %s as typed',
    (source) => {
      expect(spansOf(source)).toEqual([{ text: source }]);
    },
  );

  it.each(['**tebal belum ditutup', '_miring belum', '`kode belum', '~~coret', '[label tanpa tautan]'])('shows unclosed %s as typed', (source) => {
    expect(spansOf(source)).toEqual([{ text: source }]);
  });

  it('still links the URL of an unclosed link', () => {
    expect(spansOf('[label](https://kaitech.io')).toEqual([{ text: '[label](' }, { text: 'https://kaitech.io', href: 'https://kaitech.io' }]);
  });

  it('keeps code literal', () => {
    expect(spansOf('`**tidak tebal**` dan `a_b_c`')).toEqual([
      { text: '**tidak tebal**', code: true },
      { text: ' dan ' },
      { text: 'a_b_c', code: true },
    ]);
  });

  it('nests emphasis', () => {
    expect(spansOf('**tebal _dan miring_**')).toEqual([
      { text: 'tebal ', bold: true },
      { text: 'dan miring', bold: true, italic: true },
    ]);
    expect(spansOf('***dua-duanya***')).toEqual([{ text: 'dua-duanya', bold: true, italic: true }]);
  });

  it('does not carry emphasis across lines', () => {
    expect(spansOf('harga *naik\nturun* lagi')).toEqual([{ text: 'harga *naik\nturun* lagi' }]);
  });

  it('honours backslash escapes', () => {
    expect(spansOf('\\*bukan miring\\*')).toEqual([{ text: '*bukan miring*' }]);
  });

  it('links only safe schemes', () => {
    expect(spansOf('[Kaitech](https://kaitech.io) [surel](mailto:a@kaitech.io) [telp](tel:+62211)')).toEqual([
      { text: 'Kaitech', href: 'https://kaitech.io' },
      { text: ' ' },
      { text: 'surel', href: 'mailto:a@kaitech.io' },
      { text: ' ' },
      { text: 'telp', href: 'tel:+62211' },
    ]);
    for (const unsafe of ['[klik](javascript:alert(1))', '[klik](data:text/html,hai)', '[klik](file:///etc/passwd)', '[klik](//evil.example)']) {
      expect(spansOf(unsafe).every((span) => !span.href)).toBe(true);
      expect(spansOf(unsafe).map((span) => span.text).join('')).toBe(unsafe);
    }
  });

  it('links bare URLs without eating the punctuation around them', () => {
    expect(spansOf('lihat https://kaitech.io/a_b_c, lalu **https://x.id**.')).toEqual([
      { text: 'lihat ' },
      { text: 'https://kaitech.io/a_b_c', href: 'https://kaitech.io/a_b_c' },
      { text: ', lalu ' },
      { text: 'https://x.id', href: 'https://x.id', bold: true },
      { text: '.' },
    ]);
  });

  it('never produces raw HTML', () => {
    expect(spansOf('<b>bukan</b> <script>alert(1)</script>')).toEqual([{ text: '<b>bukan</b> <script>alert(1)</script>' }]);
  });
});

describe('markdown blocks', () => {
  it('separates paragraphs on blank lines and keeps single line breaks', () => {
    expect(parseMarkdown('baris satu\nbaris dua\n\nparagraf baru')).toEqual([
      { kind: 'text', heading: false, spans: [{ text: 'baris satu\nbaris dua' }] },
      { kind: 'text', heading: false, spans: [{ text: 'paragraf baru' }] },
    ]);
  });

  it('turns headings into plain bold lines', () => {
    expect(parseMarkdown('## Ringkasan\nisi')).toEqual([
      { kind: 'text', heading: true, spans: [{ text: 'Ringkasan' }] },
      { kind: 'text', heading: false, spans: [{ text: 'isi' }] },
    ]);
    expect(spansOf('#hashtag bukan judul')).toEqual([{ text: '#hashtag bukan judul' }]);
  });

  it('reads bullet and numbered lists with nesting', () => {
    expect(only(parseMarkdown('- satu\n* dua\n  - anak\n1. pertama\n2) kedua'))).toEqual({
      kind: 'list',
      items: [
        { marker: '', depth: 0, spans: [{ text: 'satu' }] },
        { marker: '', depth: 0, spans: [{ text: 'dua' }] },
        { marker: '', depth: 1, spans: [{ text: 'anak' }] },
        { marker: '1.', depth: 0, spans: [{ text: 'pertama' }] },
        { marker: '2)', depth: 0, spans: [{ text: 'kedua' }] },
      ],
    });
  });

  it('reads quotes as their own blocks', () => {
    expect(parseMarkdown('> kutipan **penting**\n> baris dua\njawaban')).toEqual([
      {
        kind: 'quote',
        blocks: [{ kind: 'text', heading: false, spans: [{ text: 'kutipan ' }, { text: 'penting', bold: true }, { text: '\nbaris dua' }] }],
      },
      { kind: 'text', heading: false, spans: [{ text: 'jawaban' }] },
    ]);
  });

  it('keeps fenced code verbatim, closed or not', () => {
    expect(parseMarkdown('```js\nconst a = **b**;\n  indent\n```\nsesudah')).toEqual([
      { kind: 'code', text: 'const a = **b**;\n  indent' },
      { kind: 'text', heading: false, spans: [{ text: 'sesudah' }] },
    ]);
    expect(parseMarkdown('```\nbelum ditutup')).toEqual([{ kind: 'code', text: 'belum ditutup' }]);
  });

  const table = '| Modul | Status |\n|:---|---:|\n| `sale` | **siap** |\n| stock | a \\| b |';

  it('draws pipe tables only where tables are allowed', () => {
    expect(only(parseMarkdown(table, { tables: true }))).toEqual({
      kind: 'table',
      head: [[{ text: 'Modul' }], [{ text: 'Status' }]],
      align: ['left', 'right'],
      rows: [
        [[{ text: 'sale', code: true }], [{ text: 'siap', bold: true }]],
        [[{ text: 'stock' }], [{ text: 'a | b' }]],
      ],
    });
    expect(parseMarkdown(table).some((block) => block.kind === 'table')).toBe(false);
  });

  it('pads short rows to the header width', () => {
    const block = only(parseMarkdown('| a | b | c |\n|---|---|---|\n| 1 |', { tables: true }));
    expect(block.kind === 'table' && block.rows[0].map((cell) => cell.length)).toEqual([1, 0, 0]);
  });
});

describe('markdown in chat bodies', () => {
  it('renders what the composer stored, links and mentions included', () => {
    const body = composeBody('**Rapat** @Rina_Sari lihat [notulen](https://kaitech.io/n_1)\n- satu\n- dua', [{ id: 7, name: 'Rina_Sari' }]);
    expect(bodyBlocks(body)).toEqual([
      {
        kind: 'text',
        heading: false,
        spans: [
          { text: 'Rapat', bold: true },
          { text: ' ' },
          { text: '@Rina_Sari', mention: { model: 'res.partner', id: 7 } },
          { text: ' lihat ' },
          { text: 'notulen', href: 'https://kaitech.io/n_1' },
        ],
      },
      {
        kind: 'list',
        items: [
          { marker: '', depth: 0, spans: [{ text: 'satu' }] },
          { marker: '', depth: 0, spans: [{ text: 'dua' }] },
        ],
      },
    ]);
  });

  it('reads the Coworker Discuss HTML, pipe tables in <pre> included', () => {
    const html =
      '<p><b>Ringkasan</b></p><p>Satu<br>dua</p><ol><li>pertama</li><li>kedua</li></ol>' +
      '<pre>| A | B |\n|---|---|\n| 1 | 2 |</pre><pre>def f():\n    return 1</pre>';
    expect(bodyBlocks(html)).toEqual([
      { kind: 'text', heading: false, spans: [{ text: 'Ringkasan', bold: true }] },
      { kind: 'text', heading: false, spans: [{ text: 'Satu\ndua' }] },
      {
        kind: 'list',
        items: [
          { marker: '1.', depth: 0, spans: [{ text: 'pertama' }] },
          { marker: '2.', depth: 0, spans: [{ text: 'kedua' }] },
        ],
      },
      { kind: 'table', head: [[{ text: 'A' }], [{ text: 'B' }]], align: ['left', 'left'], rows: [[[{ text: '1' }], [{ text: '2' }]]] },
      { kind: 'code', text: 'def f():\n    return 1' },
    ]);
  });

  it('keeps human pipe text as text', () => {
    expect(bodyBlocks(composeBody('| a | b |\n|---|---|\n| 1 | 2 |', [])).some((block) => block.kind === 'table')).toBe(false);
  });

  it('keeps blockquotes together across paragraphs', () => {
    expect(markdownOfHtml('<blockquote><p>satu</p><p>dua</p></blockquote><p>tiga</p>').source).toBe('> satu\n>\n> dua\n\ntiga');
  });

  it('ignores characters that would pose as placeholders', () => {
    expect(bodyBlocks('<p>\ue000 <b>x</b></p>')).toEqual([{ kind: 'text', heading: false, spans: [{ text: '\ufffd ' }, { text: 'x', bold: true }] }]);
  });

  it('previews as one plain line without markers', () => {
    expect(bodyPreview(composeBody('## Judul\n**tebal** dan _miring_\n- satu\n> kutip\n`kode`', []))).toBe('Judul tebal dan miring satu kutip kode');
  });

  it('parses each body once', () => {
    const body = '<p>**sekali**</p>';
    expect(bodyBlocks(body)).toBe(bodyBlocks(body));
    expect(sourceBlocks('**a**', true)).toBe(sourceBlocks('**a**', true));
  });
});

describe('composer markup', () => {
  const at = (text: string, start: number, end = start) => ({ start, end });

  it('wraps the selection and keeps it selected', () => {
    expect(applyMarkup('halo dunia', at('', 5, 10), 'bold')).toEqual({ text: 'halo **dunia**', selection: { start: 7, end: 12 } });
    expect(applyMarkup('halo dunia', at('', 0, 4), 'italic')).toEqual({ text: '_halo_ dunia', selection: { start: 1, end: 5 } });
    expect(applyMarkup('pakai sale_order', at('', 6, 16), 'code')).toEqual({ text: 'pakai `sale_order`', selection: { start: 7, end: 17 } });
  });

  it('keeps selected spaces outside the markers', () => {
    expect(applyMarkup('halo dunia ', at('', 5, 11), 'bold').text).toBe('halo **dunia** ');
  });

  it('unwraps when applied twice', () => {
    const once = applyMarkup('halo dunia', at('', 5, 10), 'bold');
    expect(applyMarkup(once.text, once.selection, 'bold')).toEqual({ text: 'halo dunia', selection: { start: 5, end: 10 } });
    expect(applyMarkup('**dunia**', at('', 0, 9), 'bold')).toEqual({ text: 'dunia', selection: { start: 0, end: 5 } });
  });

  it('puts the cursor between markers when nothing is selected', () => {
    expect(applyMarkup('halo ', at('', 5), 'bold')).toEqual({ text: 'halo ****', selection: { start: 7, end: 7 } });
  });

  it('wraps each line of a multi-line selection', () => {
    expect(applyMarkup('satu\ndua', at('', 0, 8), 'bold').text).toBe('**satu**\n**dua**');
    expect(applyMarkup('a\nb', at('', 0, 3), 'code').text).toBe('```\na\nb\n```');
  });

  it('builds links around a label or a URL', () => {
    expect(applyMarkup('baca notulen', at('', 5, 12), 'link')).toEqual({ text: 'baca [notulen](https://)', selection: { start: 15, end: 23 } });
    expect(applyMarkup('https://kaitech.io', at('', 0, 18), 'link')).toEqual({ text: '[](https://kaitech.io)', selection: { start: 1, end: 1 } });
  });

  it('toggles quote and list prefixes on every selected line', () => {
    expect(applyMarkup('satu\ndua\ntiga', at('', 2, 6), 'list').text).toBe('- satu\n- dua\ntiga');
    expect(applyMarkup('- satu\n- dua', at('', 0, 12), 'list').text).toBe('satu\ndua');
    expect(applyMarkup('satu\n\ndua', at('', 0, 9), 'quote').text).toBe('> satu\n>\n> dua');
    expect(applyMarkup('halo', at('', 2), 'quote')).toEqual({ text: '> halo', selection: { start: 4, end: 4 } });
  });

  it('produces text the renderer reads back', () => {
    const edit = applyMarkup('cek modul sale dan stock', at('', 10, 14), 'bold');
    expect(spansOf(edit.text)).toEqual([{ text: 'cek modul ' }, { text: 'sale', bold: true }, { text: ' dan stock' }]);
  });
});
