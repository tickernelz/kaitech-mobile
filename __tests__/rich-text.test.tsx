jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined } }));
require('../src/i18n');
import { act, create, type ReactTestRendererJSON } from 'react-test-renderer';
import { composeBody } from '../src/features/chat/html';
import { bodyBlocks, bodyShape, sourceBlocks } from '../src/features/chat/markdown';
import { RichText } from '../src/features/chat/ui/RichText';

type Node = ReactTestRendererJSON | string;

function render(blocks: ReturnType<typeof bodyBlocks>): ReactTestRendererJSON {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(<RichText blocks={blocks} />);
  });
  return tree?.toJSON() as ReactTestRendererJSON;
}

function painted(style: unknown): boolean {
  const flat = Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) as Record<string, unknown>;
  return !!(flat.backgroundColor || flat.borderWidth || flat.borderTopWidth || flat.borderRightWidth || flat.overflow === 'hidden');
}

function nativeViews(node: Node | null, nested = false): number {
  if (!node || typeof node === 'string') return 0;
  const isText = node.type === 'Text';
  const own = isText ? (nested ? 0 : 1) : node.type === 'View' ? (painted(node.props.style) ? 1 : 0) : 1;
  return own + (node.children ?? []).reduce((sum, child) => sum + nativeViews(child, nested || isText), 0);
}

function topTexts(node: Node | null, nested = false): string[] {
  if (!node || typeof node === 'string') return [];
  if (node.type === 'Text' && !nested) return [textOf(node)];
  return (node.children ?? []).flatMap((child) => topTexts(child, nested));
}

function textOf(node: Node): string {
  return typeof node === 'string' ? node : (node.children ?? []).map(textOf).join('');
}

const coworker =
  '<p><b>Ringkasan</b></p><p>Modul <code>sale</code> siap.<br>Stok menunggu.</p><ul><li>Penjualan: siap</li><li>Gudang: tunggu</li><li>Akuntansi: siap</li></ul>' +
  '<pre>| Modul | Status | Penanggung jawab | Catatan |\n|---|---|---|---|\n| sale | siap | Rina | - |\n| stock | tunggu | Budi | opname 25 Nov |\n| account | siap | Dewi | tutup buku Desember |</pre>' +
  '<p>Langkah berikut:</p><ol><li>Jadwalkan opname</li><li>Kirim laporan ke <a href="https://kaitech.io">tim</a></li></ol>';

describe('RichText native views', () => {
  it('draws paragraphs and lists that follow each other as one text', () => {
    const tree = render(sourceBlocks('Daftar cek:\n- rak A\n  - rak A1\n- kirim `PO/1`\n\n3. tiga\n4. empat', false));
    expect(topTexts(tree)).toEqual(['Daftar cek:\n\n\u2022\u2002rak A\n\u2003\u2003\u2022\u2002rak A1\n\u2022\u2002kirim PO/1\n\n3.\u2002tiga\n4.\u2002empat']);
  });

  it('stays close to the plain renderer in native views', () => {
    expect(nativeViews(render(bodyBlocks(composeBody('Pagi, barang sudah dikirim.', []))))).toBe(1);
    expect(nativeViews(render(bodyBlocks(composeBody('Daftar:\n- satu\n- dua\n- tiga\n\n> catatan', []))))).toBe(3);
    expect(nativeViews(render(bodyBlocks(coworker)))).toBeLessThanOrEqual(10);
  });

  it('draws a table of short cells one column at a time, rows aligned by line', () => {
    const texts = topTexts(render(sourceBlocks('| A | B |\n|---|---|\n| 1 | dua |\n| 3 | empat |', true)));
    expect(texts).toEqual(['A\n1\n3', 'B\ndua\nempat']);
  });

  it('keeps one text per cell when a cell could wrap', () => {
    const long = 'catatan panjang yang pasti terbungkus di kolom';
    const texts = topTexts(render(sourceBlocks(`| A | B |\n|---|---|\n| 1 | ${long} |\n| 3 | x |`, true)));
    expect(texts).toEqual(['A', 'B', '1', long, '3', 'x']);
  });

  it('tells FlashList which bubbles share a shape', () => {
    expect(bodyShape(composeBody('halo **semua**', []))).toBe('plain');
    expect(bodyShape(composeBody('- satu\n  - anak\n- dua', []))).toBe('plain');
    expect(bodyShape(composeBody('teks\n\n> kutipan', []))).toBe('rich');
    expect(bodyShape(coworker)).toBe('table');
  });
});
