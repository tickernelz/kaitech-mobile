import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRendererJSON } from 'react-test-renderer';

type Spec = { style: Record<string, unknown>; testID?: string; text?: string; children: Spec[] };
export type Box = { left: number; width: number; right: number; top: number; height: number };
export type Scene = { element: ReactElement; width: number; testID: string };

function textOf(node: ReactTestRendererJSON | string): string {
  return typeof node === 'string' ? node : (node.children ?? []).map(textOf).join('');
}

function spec(node: ReactTestRendererJSON): Spec {
  const style = (StyleSheet.flatten(node.props.style) ?? {}) as Record<string, unknown>;
  const testID = node.props.testID as string | undefined;
  if (node.type === 'Text') return { style, testID, text: textOf(node), children: [] };
  return { style, testID, children: (node.children ?? []).filter((child): child is ReactTestRendererJSON => typeof child !== 'string').map(spec) };
}

function tree(element: ReactElement): Spec {
  let rendered: ReturnType<typeof create> | undefined;
  act(() => {
    rendered = create(element);
  });
  const json = rendered?.toJSON();
  const roots = (Array.isArray(json) ? json : [json]).filter((node): node is ReactTestRendererJSON => !!node);
  return { style: {}, children: roots.map(spec) };
}

type Laid = Record<string, { left: number; width: number; top: number; height: number }>;

function layout(trees: { width: number; tree: Spec }[]): Laid[] {
  return JSON.parse(execFileSync(process.execPath, [join(__dirname, 'yoga-layout.mjs')], { input: JSON.stringify(trees), encoding: 'utf8' })) as Laid[];
}

const boxed = (laid: Laid[string], width: number): Box => ({ ...laid, right: width - laid.left - laid.width });

export function measure(scenes: Record<string, Scene>): Record<string, Box> {
  const names = Object.keys(scenes);
  const output = layout(names.map((name) => ({ width: scenes[name].width, tree: tree(scenes[name].element) })));
  return Object.fromEntries(names.map((name, index) => [name, boxed(output[index][scenes[name].testID], scenes[name].width)]));
}

export function measureRendered(json: ReactTestRendererJSON | ReactTestRendererJSON[] | null, width: number): Record<string, Box> {
  const roots = (Array.isArray(json) ? json : [json]).filter((node): node is ReactTestRendererJSON => !!node);
  const [laid] = layout([{ width, tree: { style: {}, children: roots.map(spec) } }]);
  return Object.fromEntries(Object.entries(laid).map(([id, box]) => [id, boxed(box, width)]));
}
