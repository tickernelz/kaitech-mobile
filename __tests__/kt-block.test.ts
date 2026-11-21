import { createElement, type ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import fixtures from './fixtures/kt-blocks.json';
import en from '../src/i18n/locales/en.json';
import id from '../src/i18n/locales/id.json';
import { splitBlocks } from '../src/features/discovery/blocks';
import { Markdown } from '../src/features/discovery/Markdown';
import { allowsLoad, sealed, versionsOf } from '../src/features/discovery/kt/Artifact';
import { drawnOf, figureOf, niceTicks, squeezed } from '../src/features/discovery/kt/chartShape';
import { pictureOf } from '../src/features/discovery/kt/Diagram';
import { numbersFor } from '../src/features/discovery/kt/format';
import { ThreadContext, type Thread } from '../src/features/discovery/kt/place';
import { parseBlock, readArtifact, readChart, readDiagram, type Obj } from '../src/features/discovery/kt/read';
import { blockKinds, knownKinds } from '../src/features/discovery/kt/registry';
import { formMessage } from '../src/features/discovery/kt/Saying';
import i18n from '../src/i18n';
import { Platform } from 'react-native';

jest.mock('expo-sqlite/kv-store', () => ({ getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
const webViews: Record<string, unknown>[] = [];
jest.mock('react-native-webview', () => ({
  WebView: (props: Record<string, unknown>) => {
    webViews.push(props);
    return null;
  },
}));

type Fixture = { kind: string; origin: string; raw: string };
type Edge = { name: string; note: string; valid: boolean; raw: string };
const blocks = fixtures.blocks as Fixture[];
const edges = fixtures.edges as Edge[];
const edge = (name: string) => edges.find((one) => one.name === name)!.raw;
const numbers = numbersFor('id');
const words = { stepBefore: (value: string, share: string) => value + ' ' + share, of: (max: string) => max };

function fenced(raw: string) {
  return 'Ada satu hal yang perlu Bapak putuskan.\n\n```kt-block\n' + raw + '\n```\nSetelah itu saya lanjutkan.';
}

function inThread(children: ReactNode, thread: Partial<Thread> = {}) {
  return createElement(ThreadContext.Provider, { value: { account: null, origin: 'https://erp.example.com', items: [], ...thread } }, children);
}

async function draw(raw: string, thread: Partial<Thread> = {}) {
  return render(inThread(createElement(Markdown, { text: fenced(raw), place: { turnId: 7, seq: 3, reads: null } }), thread));
}

beforeAll(async () => {
  await i18n.changeLanguage('id');
});

describe('splitBlocks', () => {
  it('cuts a kt-block out of the prose around it', () => {
    const raw = blocks[0].raw;
    expect(splitBlocks(fenced(raw))).toEqual([
      { kind: 'text', text: 'Ada satu hal yang perlu Bapak putuskan.\n' },
      { kind: 'block', raw },
      { kind: 'text', text: 'Setelah itu saya lanjutkan.' },
    ]);
  });

  it('negative control: other code fences stay prose', () => {
    const source = 'Contoh:\n```json\n{"type":"replies"}\n```';
    expect(splitBlocks(source)).toEqual([{ kind: 'text', text: source }]);
  });

  it('takes an unclosed kt-block to the end of the message', () => {
    expect(splitBlocks('Teks\n```kt-block\n{"a":1}')).toEqual([
      { kind: 'text', text: 'Teks' },
      { kind: 'block', raw: '{"a":1}' },
    ]);
  });
});

describe('block kinds', () => {
  it('draws every kind the web registers, and no other', () => {
    expect(knownKinds).toEqual([...fixtures.web.kinds].sort());
  });

  it('negative control: a kind the web adds later is caught', () => {
    expect([...fixtures.web.kinds, 'map'].sort()).not.toEqual(knownKinds);
  });

  it.each(blocks.map((block, index) => [block.kind + ' #' + index + ' (' + block.origin.slice(0, 40) + ')', block] as const))('reads %s as the web does', (_, block) => {
    const parsed = parseBlock(block.raw);
    if (parsed.state !== 'read') throw new Error('broken fixture');
    expect(blockKinds[block.kind].read(parsed.data)).not.toBeNull();
  });

  it.each(blocks.map((block, index) => [block.kind + ' #' + index, block] as const))('draws %s without its JSON or a fallback', async (_, block) => {
    await draw(block.raw);
    expect(screen.getByTestId('kt-block-' + block.kind)).toBeTruthy();
    expect(screen.queryByTestId('kt-block-generic')).toBeNull();
    expect(screen.queryByText(/"type"/)).toBeNull();
    expect(screen.getByText('Setelah itu saya lanjutkan.')).toBeTruthy();
  });

  it('keeps every chart and diagram drawing free of NaN at phone width', () => {
    for (const block of blocks) {
      const parsed = parseBlock(block.raw);
      if (parsed.state !== 'read') continue;
      if (block.kind === 'chart') {
        const chart = readChart(parsed.data)!;
        const figure = JSON.stringify(figureOf(chart, drawnOf(chart), 320, numbers, words));
        expect(figure).not.toMatch(/NaN|Infinity/);
      }
      if (block.kind === 'diagram') {
        const picture = pictureOf(readDiagram(parsed.data)!, numbers, 'Hari ini');
        expect(JSON.stringify(picture)).not.toMatch(/NaN|Infinity|undefined/);
        expect(picture.width).toBeGreaterThan(0);
      }
    }
  });
});

describe('fallbacks', () => {
  it('shows broken JSON as raw code, never an apology', async () => {
    const raw = edge('truncated_json');
    await draw(raw);
    expect(screen.getByTestId('kt-block-raw')).toBeTruthy();
    expect(screen.getByText(raw)).toBeTruthy();
    expect(JSON.stringify([en, id])).not.toMatch(/unreadable|cannot show|belum bisa ditampilkan/);
  });

  it('shows a kind the app does not know by title, summary, derived table and a web link', async () => {
    await draw(edge('unknown_kind'));
    expect(screen.getByTestId('kt-block-generic')).toBeTruthy();
    expect(screen.getByText('Peta cabang')).toBeTruthy();
    expect(screen.getByText('Lokasi tiga cabang.')).toBeTruthy();
    expect(screen.getByText('Surabaya')).toBeTruthy();
    expect(screen.getByTestId('kt-block-web')).toBeTruthy();
  });

  it('shows a table wider than the web allows as a plain table of its first 12 columns', async () => {
    await draw(edge('wide_columns'));
    expect(screen.getByTestId('kt-block-generic')).toBeTruthy();
    expect(screen.getByText('K11')).toBeTruthy();
    expect(screen.queryByText('K12')).toBeNull();
  });

  it('negative control: eleven sources break the frame like on the web, ten do not', async () => {
    await draw(edge('eleven_sources'));
    expect(screen.getByTestId('kt-block-generic')).toBeTruthy();
    await draw(edge('ten_sources'));
    expect(screen.getByTestId('kt-block-checklist')).toBeTruthy();
    expect(screen.getByText('Sumber 10')).toBeTruthy();
  });

  it('negative control: replies the web would refuse are not offered as buttons', () => {
    for (const bad of [[], ['a', 'a'], ['a', 'b', 'c', 'd', 'e'], ['x'.repeat(61)], [' '], [1]]) {
      const parsed = parseBlock(JSON.stringify({ type: 'replies', summary: 'Pilih', replies: bad }));
      expect(parsed.state === 'read' && blockKinds.replies.read(parsed.data as Obj)).toBeNull();
    }
  });
});

describe('interaction', () => {
  it('sends a quick reply once', async () => {
    const onReply = jest.fn();
    await draw(blocks.find((block) => block.kind === 'replies')!.raw, { onReply });
    await fireEvent.press(screen.getByTestId('kt-reply-1'));
    expect(onReply).toHaveBeenCalledWith('Bukan begitu maksud saya');
    await fireEvent.press(screen.getByTestId('kt-reply-0'));
    expect(onReply).toHaveBeenCalledTimes(1);
  });

  it('holds a form back until its required field is filled, then sends the answers as one message', async () => {
    const onReply = jest.fn();
    const raw = blocks.find((block) => block.kind === 'form')!.raw;
    await draw(raw, { onReply });
    await fireEvent.press(screen.getByTestId('kt-form-send'));
    expect(onReply).not.toHaveBeenCalled();
    expect(screen.getByText('Isi bagian ini untuk mengirim formulir.')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('kt-form-proses_1'), 'Order sampai faktur');
    await fireEvent.changeText(screen.getByTestId('kt-form-proses_3'), 'Retur');
    await fireEvent.press(screen.getByTestId('kt-form-send'));
    expect(onReply).toHaveBeenCalledWith('Proses yang dicakup\n- Proses 1 (dari mana sampai mana): Order sampai faktur\n- Proses 3: Retur');
    expect(screen.getByText('Terkirim sebagai pesan Anda.')).toBeTruthy();
  });

  it('writes the form message like the web, skipping empty answers', () => {
    const parsed = parseBlock(JSON.stringify({ type: 'form', summary: 's', submit_label: 'Kirim', fields: [{ name: 'a', label: 'Tanggal', kind: 'date' }, { name: 'b', label: 'Peserta', kind: 'people', choices: ['Ani', 'Budi'] }] }));
    const form = parsed.state === 'read' ? (blockKinds.form.read(parsed.data) as Parameters<typeof formMessage>[0]) : null;
    expect(formMessage(form!, { a: '', b: ['Ani', 'Budi'] })).toBe('Kirim\n- Peserta: Ani, Budi');
  });

  it('opens and closes accordion items, the marked one open first', async () => {
    await draw(blocks.find((block) => block.kind === 'accordion')!.raw);
    expect(screen.getByText(/Sudah dimiliki: KAK/)).toBeTruthy();
    expect(screen.queryByText(/Sudah dimiliki sebagai draf/)).toBeNull();
    await fireEvent.press(screen.getByTestId('kt-accordion-1'));
    expect(screen.getByText(/Sudah dimiliki sebagai draf/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('kt-accordion-0'));
    expect(screen.queryByText(/Sudah dimiliki: KAK/)).toBeNull();
  });

  it('shows 20 rows of a long table, every row on request, and the total of all of them', async () => {
    await draw(edge('many_rows'));
    expect(screen.getByText('P019')).toBeTruthy();
    expect(screen.queryByText('P020')).toBeNull();
    expect(screen.getByText('60 dari 75 baris tercantum')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('kt-table-all'));
    expect(screen.getByText('P059')).toBeTruthy();
    expect(screen.getByText(numbers.number(1830000, 0))).toBeTruthy();
  });

  it('copies a table as Markdown with the total row, like the web', async () => {
    await draw(blocks.find((block) => block.kind === 'table')!.raw);
    await act(async () => {
      fireEvent.press(screen.getByTestId('kt-table-copy'));
    });
    const markdown = (Clipboard.setStringAsync as jest.Mock).mock.calls.at(-1)[0] as string;
    const lines = markdown.split('\n');
    expect(lines[0]).toBe('| Nama | Peran menurut catatan | Acuan bank | Pertanyaan |');
    expect(lines[1]).toBe('| --- | --- | --- | ---: |');
    expect(lines).toHaveLength(2 + 19 + 1);
    expect(lines.at(-1)).toBe('| **Total** |  |  | **85** |');
  });

  it('filters a table by status', async () => {
    await draw(edge('many_rows'));
    await fireEvent.press(screen.getByTestId('kt-table-filter'));
    await fireEvent.press(screen.getAllByRole('checkbox').find((box) => within(box).queryByText('terlambat'))!);
    expect(screen.getByText('Menampilkan 20 dari 40 baris')).toBeTruthy();
  });
});

describe('artifact sandbox', () => {
  it('runs the page sealed: no bridge, no navigation, no network in its policy', async () => {
    webViews.length = 0;
    await draw(blocks.filter((block) => block.kind === 'artifact')[1].raw);
    await fireEvent.press(screen.getByTestId('kt-artifact-open'));
    await waitFor(() => expect(webViews.length).toBeGreaterThan(0));
    const props = webViews.at(-1)!;
    expect(props.onMessage).toBeUndefined();
    expect(props.injectedJavaScript).toBeUndefined();
    expect(props.domStorageEnabled).toBe(false);
    expect(props.sharedCookiesEnabled).toBe(false);
    expect(props.incognito).toBe(Platform.OS === 'ios');
    const allow = props.onShouldStartLoadWithRequest as (request: { url: string }) => boolean;
    expect(allow({ url: 'about:blank' })).toBe(true);
    expect(allow({ url: 'https://example.com/' })).toBe(false);
    expect(allow({ url: 'file:///data/user/0/io.kaitech.mobile/files/x' })).toBe(false);
    expect((props.source as { html: string }).html).toContain("connect-src 'none'");
  });

  it('numbers versions of one artifact across the thread', () => {
    const [first, second] = blocks.filter((block) => block.kind === 'artifact');
    const items = [first, second].map((block, index) => ({ turnId: 10 + index, seq: 1, kind: 'message', author: 'c', name: '', body: fenced(block.raw), occurredAt: '' }));
    const parsed = parseBlock(second.raw);
    const artifact = readArtifact(parsed.state === 'read' ? parsed.data : {})!;
    const { versions, own } = versionsOf(items, artifact, { turnId: 11, seq: 1, index: 0, reads: null });
    expect(versions.map((version) => version.number)).toEqual([1, 2]);
    expect(own.number).toBe(2);
    expect(allowsLoad('javascript:alert(1)')).toBe(false);
    expect(sealed('<p>x</p>').indexOf('Content-Security-Policy')).toBeLessThan(sealed('<p>x</p>').indexOf('<p>x</p>'));
  });
});

describe('chart arithmetic', () => {
  it('picks round ticks that cover the data', () => {
    expect(niceTicks(0, 63)).toEqual({ ticks: [0, 20, 40, 60, 80], step: 20 });
  });

  it('averages more than 400 points into buckets the note can name', () => {
    const x = Array.from({ length: 1000 }, (_, index) => index);
    const drawn = squeezed(x, [{ name: 'a', values: x }]);
    expect(drawn.size).toBe(3);
    expect(drawn.x).toHaveLength(334);
    expect(drawn.series[0].values[0]).toBe(1);
  });
});
