import vectors from './fixtures/markdown_vectors.json';
import { composeBody } from '../src/features/chat/html';
import { bodyBlocks, bodyPreview, htmlBlocks, markdownToHtml, sourceBlocks } from '../src/features/chat/markdown';
import { applyMarkup } from '../src/features/chat/markup';

type Vector = { name: string; source: string; html: string; tables?: boolean };
type Composed = { name: string; body: string; html: string };

describe('shared Markdown vectors (ZHA-7424 contract)', () => {
  it.each((vectors.vectors as Vector[]).map((vector) => [vector.name, vector]))('%s renders the contract HTML', (_name, vector) => {
    expect(markdownToHtml(vector.source, { tables: vector.tables !== false })).toBe(vector.html);
  });

  it.each((vectors.vectors as Vector[]).map((vector) => [vector.name, vector]))('%s draws the contract tree', (_name, vector) => {
    expect(sourceBlocks(vector.source, vector.tables !== false)).toEqual(htmlBlocks(vector.html));
  });

  it.each((vectors.composed as Composed[]).map((vector) => [vector.name, vector]))('%s', (_name, vector) => {
    expect(bodyBlocks(vector.body)).toEqual(htmlBlocks(vector.html || vector.body));
  });
});

describe('message trees', () => {
  it('draws inline styles, nested lists and numbered starts', () => {
    expect(sourceBlocks('**tebal** _miring_ ~~coret~~ `kode`\n\n- induk\n  - anak\n\n3. tiga\n4. empat\n\n---', false)).toEqual([
      {
        kind: 'text',
        spans: [
          { text: 'tebal', bold: true },
          { text: ' ' },
          { text: 'miring', italic: true },
          { text: ' ' },
          { text: 'coret', strike: true },
          { text: ' ' },
          { text: 'kode', code: true },
        ],
      },
      {
        kind: 'list',
        ordered: false,
        start: 1,
        items: [{ spans: [{ text: 'induk' }], sub: [{ kind: 'list', ordered: false, start: 1, items: [{ spans: [{ text: 'anak' }], sub: [] }] }] }],
      },
      {
        kind: 'list',
        ordered: true,
        start: 3,
        items: [
          { spans: [{ text: 'tiga' }], sub: [] },
          { spans: [{ text: 'empat' }], sub: [] },
        ],
      },
      { kind: 'rule' },
    ]);
  });

  it('keeps snake_case, products and unclosed marks as typed', () => {
    for (const source of ['stock_move_line.csv', '2*3*4', '**belum ditutup', '_miring belum', '`kode belum', '*) catatan']) {
      expect(sourceBlocks(source, false)).toEqual([{ kind: 'text', spans: [{ text: source }] }]);
    }
  });

  it('never links unsafe schemes and never interprets typed HTML', () => {
    expect(sourceBlocks('[klik](javascript:alert(1)) <b>x</b> [a](data:text/html,1)', false)).toEqual([
      { kind: 'text', spans: [{ text: '[klik](javascript:alert(1)) <b>x</b> [a](data:text/html,1)' }] },
    ]);
  });

  it('draws pipe tables only for the Coworker', () => {
    const table = '| Modul | Status |\n|:---|---:|\n| `sale` | **siap** |';
    expect(sourceBlocks(table, true)).toEqual([
      {
        kind: 'table',
        head: [[{ text: 'Modul' }], [{ text: 'Status' }]],
        rows: [[[{ text: 'sale', code: true }], [{ text: 'siap', bold: true }]]],
        align: ['left', 'right'],
      },
    ]);
    expect(sourceBlocks(table, false).some((block) => block.kind === 'table')).toBe(false);
  });

  it('ignores characters typed to pose as placeholders', () => {
    expect(sourceBlocks('a\ue0000\ue001 **b**', false)).toEqual([{ kind: 'text', spans: [{ text: 'a0 ' }, { text: 'b', bold: true }] }]);
    expect(bodyBlocks('\ue0000\ue001 *x* <a href="https://k.io">k</a>')).toEqual([
      { kind: 'text', spans: [{ text: '0 ' }, { text: 'x', italic: true }, { text: ' ' }, { text: 'k', href: 'https://k.io' }] },
    ]);
  });
});

describe('Discuss bodies', () => {
  it('renders what this app posts, mentions kept', () => {
    const body = composeBody('**Rapat** @Rina_Sari lihat [notulen](https://kaitech.io/n_1)\n- satu\n- dua', [{ id: 7, name: 'Rina_Sari' }]);
    expect(bodyBlocks(body)).toEqual([
      {
        kind: 'text',
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
        ordered: false,
        start: 1,
        items: [
          { spans: [{ text: 'satu' }], sub: [] },
          { spans: [{ text: 'dua' }], sub: [] },
        ],
      },
    ]);
  });

  it('shows the Coworker server HTML as it is, tables included', () => {
    const html =
      '<p><b>Ringkasan</b> pakai *bintang*</p><ol start="2"><li>dua</li></ol><table><thead><tr><th>A</th><th style="text-align:right">B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table><hr>';
    expect(bodyBlocks(html)).toEqual([
      { kind: 'text', spans: [{ text: 'Ringkasan', bold: true }, { text: ' pakai *bintang*' }] },
      { kind: 'list', ordered: true, start: 2, items: [{ spans: [{ text: 'dua' }], sub: [] }] },
      { kind: 'table', head: [[{ text: 'A' }], [{ text: 'B' }]], rows: [[[{ text: '1' }], [{ text: '2' }]]], align: ['left', 'right'] },
      { kind: 'rule' },
    ]);
  });

  it('draws older Coworker tables sent as <pre> pipes', () => {
    expect(bodyBlocks('<p>Status:</p><pre>| A | B |\n|---|---|\n| 1 | 2 |</pre><pre>def f():\n    return 1</pre>')).toEqual([
      { kind: 'text', spans: [{ text: 'Status:' }] },
      { kind: 'table', head: [[{ text: 'A' }], [{ text: 'B' }]], rows: [[[{ text: '1' }], [{ text: '2' }]]], align: ['left', 'left'] },
      { kind: 'code', text: 'def f():\n    return 1' },
    ]);
  });

  it('keeps a person typing pipes as text', () => {
    expect(bodyBlocks(composeBody('| a | b |\n|---|---|\n| 1 | 2 |', [])).some((block) => block.kind === 'table')).toBe(false);
  });

  it('drops script and style content', () => {
    expect(bodyBlocks('<style>p{}</style><p>a<!-- b --></p><script>c()</script>')).toEqual([{ kind: 'text', spans: [{ text: 'a' }] }]);
  });

  it('previews as one line without marks', () => {
    expect(bodyPreview(composeBody('## Judul\n**tebal** dan _miring_\n- satu\n> kutip\n`kode`', []))).toBe('Judul tebal dan miring satu kutip kode');
  });

  it('parses each body once', () => {
    const body = '<p>**sekali**</p>';
    expect(bodyBlocks(body)).toBe(bodyBlocks(body));
    expect(sourceBlocks('**a**', true)).toBe(sourceBlocks('**a**', true));
  });
});

describe('composer markup', () => {
  const at = (start: number, end = start) => ({ start, end });

  it('wraps the selection and keeps it selected', () => {
    expect(applyMarkup('halo dunia', at(5, 10), 'bold')).toEqual({ text: 'halo **dunia**', selection: { start: 7, end: 12 } });
    expect(applyMarkup('halo dunia', at(0, 4), 'italic')).toEqual({ text: '_halo_ dunia', selection: { start: 1, end: 5 } });
    expect(applyMarkup('pakai sale_order', at(6, 16), 'code')).toEqual({ text: 'pakai `sale_order`', selection: { start: 7, end: 17 } });
  });

  it('keeps selected spaces outside the markers', () => {
    expect(applyMarkup('halo dunia ', at(5, 11), 'bold').text).toBe('halo **dunia** ');
  });

  it('unwraps when applied twice', () => {
    const once = applyMarkup('halo dunia', at(5, 10), 'bold');
    expect(applyMarkup(once.text, once.selection, 'bold')).toEqual({ text: 'halo dunia', selection: { start: 5, end: 10 } });
    expect(applyMarkup('**dunia**', at(0, 9), 'bold')).toEqual({ text: 'dunia', selection: { start: 0, end: 5 } });
  });

  it('puts the cursor between markers when nothing is selected', () => {
    expect(applyMarkup('halo ', at(5), 'bold')).toEqual({ text: 'halo ****', selection: { start: 7, end: 7 } });
  });

  it('formats the word under a resting cursor', () => {
    expect(applyMarkup('cek modul sale hari', at(11), 'bold')).toEqual({ text: 'cek modul **sale** hari', selection: { start: 12, end: 16 } });
    expect(applyMarkup('pakai sale_order', at(16), 'code').text).toBe('pakai `sale_order`');
    expect(applyMarkup('baca notulen', at(7), 'link').text).toBe('baca [notulen](https://)');
  });

  it('wraps each line of a multi-line selection', () => {
    expect(applyMarkup('satu\ndua', at(0, 8), 'bold').text).toBe('**satu**\n**dua**');
    expect(applyMarkup('a\nb', at(0, 3), 'code').text).toBe('```\na\nb\n```');
  });

  it('builds links around a label or a URL', () => {
    expect(applyMarkup('baca notulen', at(5, 12), 'link')).toEqual({ text: 'baca [notulen](https://)', selection: { start: 15, end: 23 } });
    expect(applyMarkup('https://kaitech.io', at(0, 18), 'link')).toEqual({ text: '[](https://kaitech.io)', selection: { start: 1, end: 1 } });
  });

  it('toggles quote and list prefixes on every selected line', () => {
    expect(applyMarkup('satu\ndua\ntiga', at(2, 6), 'list').text).toBe('- satu\n- dua\ntiga');
    expect(applyMarkup('- satu\n- dua', at(0, 12), 'list').text).toBe('satu\ndua');
    expect(applyMarkup('satu\n\ndua', at(0, 9), 'quote').text).toBe('> satu\n>\n> dua');
    expect(applyMarkup('halo', at(2), 'quote')).toEqual({ text: '> halo', selection: { start: 4, end: 4 } });
  });

  it.each(['bold', 'italic', 'code', 'link', 'quote', 'list'] as const)('%s produces text the renderer formats', (markup) => {
    const edit = applyMarkup('cek modul sale', at(10, 14), markup);
    const typed = markup === 'link' ? edit.text.replace('https://', 'https://kaitech.io') : edit.text;
    expect(sourceBlocks(typed, false)).not.toEqual([{ kind: 'text', spans: [{ text: typed }] }]);
  });
});
