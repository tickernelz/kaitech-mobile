jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined } }));
require('../src/i18n');
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PixelRatio, StyleSheet } from 'react-native';
import { act, create, type ReactTestRendererJSON } from 'react-test-renderer';
import { sourceBlocks } from '../src/features/chat/markdown';
import { LONG_PRESS_MS, RichText } from '../src/features/chat/ui/RichText';

type Spec = { style: Record<string, unknown>; testID?: string; text?: string; children: Spec[] };
type Box = { left: number; width: number };

const viewport = 278;

function textOf(node: ReactTestRendererJSON | string): string {
  return typeof node === 'string' ? node : (node.children ?? []).map(textOf).join('');
}

function flat(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style as never) ?? {}) as Record<string, unknown>;
}

function spec(node: ReactTestRendererJSON, columns: { next: number }): Spec {
  const style = flat(node.props.style);
  if (node.type === 'Text') return { style, testID: `column-${columns.next++}`, text: textOf(node), children: [] };
  const children = (node.children ?? []).filter((child): child is ReactTestRendererJSON => typeof child !== 'string');
  if (node.type === 'RCTScrollView' && node.props.horizontal) {
    const [content] = children;
    return {
      style: { flexGrow: 1, flexShrink: 1, flexDirection: 'row', overflow: 'scroll', ...style },
      testID: node.props.testID as string,
      children: [{ style: { flexDirection: 'row', ...flat(node.props.contentContainerStyle) }, testID: 'content', children: (content.children ?? []).filter((child): child is ReactTestRendererJSON => typeof child !== 'string').map((child) => spec(child, columns)) }],
    };
  }
  return { style, testID: node.props.testID as string | undefined, children: children.map((child) => spec(child, columns)) };
}

function layout(markdown: string): { boxes: Record<string, Box>; widths: number[]; border: number } {
  let tree: ReturnType<typeof create> | undefined;
  act(() => {
    tree = create(<RichText blocks={sourceBlocks(markdown, true)} />);
  });
  const root = spec(tree!.toJSON() as ReactTestRendererJSON, { next: 0 });
  const widths: number[] = [];
  const visit = (node: Spec) => {
    if (node.testID?.startsWith('column-')) widths.push(node.style.width as number);
    node.children.forEach(visit);
  };
  visit(root);
  const table = root.children[0].children[0].children[0];
  const output = execFileSync(process.execPath, [join(__dirname, 'fixtures', 'yoga-layout.mjs')], { input: JSON.stringify([{ width: viewport, tree: root }]), encoding: 'utf8' });
  return { boxes: JSON.parse(output)[0], widths, border: table.style.borderWidth as number };
}

const wide =
  '| Kolom 1 | Kolom 2 | Kolom 3 | Kolom 4 | Kolom 5 | Kolom 6 |\n|---|---|---|---|---|---|\n' +
  '| PO/2026/101 | PO/2026/102 | PO/2026/103 | PO/2026/104 | PO/2026/105 | PO/2026/106 |\n' +
  '| PO/2026/201 | PO/2026/202 | PO/2026/203 | PO/2026/204 | PO/2026/205 | PO/2026/206 |';

describe('markdown table layout', () => {
  beforeEach(() => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('gives the scroll content the width of every column, wider than the bubble', () => {
    const { boxes, widths, border } = layout(wide);
    const sum = widths.reduce((total, width) => total + width, 0);
    expect(widths).toHaveLength(6);
    expect(boxes['markdown-table'].width).toBe(viewport);
    expect(boxes.content.width).toBeCloseTo(sum + 2 * border, 5);
    expect(boxes.content.width).toBeGreaterThan(viewport);
    expect(boxes['column-5'].left + boxes['column-5'].width).toBeLessThanOrEqual(boxes.content.left + boxes.content.width);
  });

  it('lets the table scroller take a sideways drag away from the bubble around it', () => {
    const onLongPress = jest.fn();
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(<RichText blocks={sourceBlocks(wide, true)} onLongPress={onLongPress} />);
    });
    const scroller = tree!.root.findByProps({ testID: 'markdown-table' });
    const content = scroller.findAll((node) => typeof node.type === 'string' && node.props.testID === 'markdown-table-content');
    expect(content).toHaveLength(1);
    expect(content[0].props.onStartShouldSetResponder()).toBe(true);
    expect(content[0].props.onResponderTerminationRequest()).toBe(true);
    jest.useFakeTimers();
    const touch = { nativeEvent: { pageX: 10, pageY: 10, locationX: 10, locationY: 10, timestamp: 0, touches: [], changedTouches: [] }, currentTarget: 1, persist: () => undefined };
    act(() => content[0].props.onResponderGrant(touch));
    act(() => jest.advanceTimersByTime(LONG_PRESS_MS + 50));
    expect(onLongPress).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('leaves the touch to the parent when no long press is wired, like a pending bubble', () => {
    let tree: ReturnType<typeof create> | undefined;
    act(() => {
      tree = create(<RichText blocks={sourceBlocks(wide, true)} />);
    });
    const content = tree!.root.findAll((node) => typeof node.type === 'string' && node.props.testID === 'markdown-table-content');
    expect(content).toHaveLength(1);
    expect(content[0].props.onStartShouldSetResponder).toBeUndefined();
  });

  it('keeps the per-cell fallback as wide as its columns', () => {
    const long = 'catatan panjang yang pasti terbungkus di kolom';
    const { boxes, widths, border } = layout(`| A | B | C | D |\n|---|---|---|---|\n| ${long} | ${long} | ${long} | x |`);
    const columns = widths.slice(0, 4);
    expect(boxes.content.width).toBeCloseTo(columns.reduce((total, width) => total + width, 0) + 2 * border, 5);
    expect(boxes.content.width).toBeGreaterThan(viewport);
  });
});
