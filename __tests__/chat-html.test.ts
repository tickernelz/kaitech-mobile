import { composeBody, decodeEntities, parseBody, plainText } from '../src/features/chat/html';

describe('parseBody', () => {
  it('keeps paragraphs, line breaks and inline styles', () => {
    const blocks = parseBody('<p>Halo <b>tim</b>,<br>cek <i>ini</i></p><p>Kedua &amp; terakhir</p>');
    expect(blocks.map((block) => block.spans.map((span) => span.text).join(''))).toEqual(['Halo tim,\ncek ini', 'Kedua & terakhir']);
    expect(blocks[0].spans.find((span) => span.text === 'tim')?.bold).toBe(true);
    expect(blocks[0].spans.find((span) => span.text === 'ini')?.italic).toBe(true);
  });

  it('turns Odoo mention links into mentions and keeps only safe link schemes', () => {
    const [block] = parseBody(
      '<a href="/odoo/res.partner/7" class="o_mail_redirect" data-oe-id="7" data-oe-model="res.partner">@Rina</a> lihat <a href="https://example.com/a">tautan</a> <a href="javascript:alert(1)">x</a>',
    );
    expect(block.spans[0]).toMatchObject({ text: '@Rina', mention: { model: 'res.partner', id: 7 } });
    expect(block.spans.find((span) => span.text === 'tautan')?.href).toBe('https://example.com/a');
    expect(block.spans.some((span) => span.href?.startsWith('javascript'))).toBe(false);
  });

  it('drops scripts, styles and comments', () => {
    expect(plainText('<style>p{}</style><p>a<!-- b --></p><script>c()</script>')).toBe('a');
  });

  it('marks list items and quotes', () => {
    const blocks = parseBody('<ul><li>satu</li><li>dua</li></ul><blockquote>kutip</blockquote>');
    expect(blocks.map((block) => [block.item, block.quote])).toEqual([
      [true, false],
      [true, false],
      [false, true],
    ]);
  });

  it('decodes numeric entities', () => {
    expect(decodeEntities('&#128077; &#x2713; &nbsp;&unknown;')).toBe('\u{1F44D} \u2713 \u00a0&unknown;');
  });
});

describe('composeBody', () => {
  it('escapes markup the person typed', () => {
    expect(composeBody('<b>bukan tebal</b> & "kutip"', [])).toBe('&lt;b&gt;bukan tebal&lt;/b&gt; &amp; &quot;kutip&quot;');
  });

  it('keeps line breaks and links addresses', () => {
    expect(composeBody('baris 1\nlihat https://example.com/x.', [])).toBe(
      'baris 1<br>lihat <a href="https://example.com/x" target="_blank" rel="noreferrer noopener">https://example.com/x</a>.',
    );
  });

  it('links only the mentions still in the text, longest name first', () => {
    const body = composeBody('@Rina Sari dan @Rina tolong cek', [
      { id: 7, name: 'Rina' },
      { id: 8, name: 'Rina Sari' },
      { id: 9, name: 'Budi' },
    ]);
    expect(body).toContain('data-oe-id="8" data-oe-model="res.partner" target="_blank" contenteditable="false">@Rina Sari</a>');
    expect(body).toContain('data-oe-id="7" data-oe-model="res.partner" target="_blank" contenteditable="false">@Rina</a> tolong');
    expect(body).not.toContain('data-oe-id="9"');
    expect(plainText(body)).toBe('@Rina Sari dan @Rina tolong cek');
  });

  it('returns nothing for blank text', () => {
    expect(composeBody('  \n ', [])).toBe('');
  });
});
