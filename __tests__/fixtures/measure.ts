import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import { act, create, type ReactTestRendererJSON } from 'react-test-renderer';

type Spec = { style: Record<string, unknown>; testID?: string; text?: string; children: Spec[] };
export type Box = { left: number; width: number; right: number };
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

export function measure(scenes: Record<string, Scene>): Record<string, Box> {
  const names = Object.keys(scenes);
  const input = JSON.stringify(names.map((name) => ({ width: scenes[name].width, tree: tree(scenes[name].element) })));
  const output = JSON.parse(execFileSync(process.execPath, [join(__dirname, 'yoga-layout.mjs')], { input, encoding: 'utf8' })) as Record<string, { left: number; width: number }>[];
  return Object.fromEntries(
    names.map((name, index) => {
      const box = output[index][scenes[name].testID];
      return [name, { ...box, right: scenes[name].width - box.left - box.width }];
    }),
  );
}
