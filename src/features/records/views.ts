import type { Fields } from './api';
import { elements, parseXml, textOf, type XmlNode } from './xml';

export type ButtonSpec = {
  kind: 'button';
  key: string;
  name: string;
  type: 'object' | 'action';
  string: string;
  invisible: string[];
  primary: boolean;
  confirm?: string;
  context?: string;
};

export type FieldSpec = {
  kind: 'field';
  name: string;
  string?: string;
  widget?: string;
  invisible: string[];
  readonly?: string;
  required?: string;
  onChange: boolean;
  context?: string;
  domain?: string;
  options?: string;
  placeholder?: string;
};

export type TextSpec = { kind: 'text'; text: string; invisible: string[]; tone: 'info' | 'warn' | 'danger' | 'plain' };

export type Item = FieldSpec | TextSpec | ButtonSpec;

export type Block = { key: string; title?: string; invisible: string[]; items: Item[] };

export type FormSpec = {
  create: boolean;
  edit: boolean;
  remove: boolean;
  header: ButtonSpec[];
  statusbar?: { name: string; visible: string[] };
  smart: ButtonSpec[];
  title: FieldSpec[];
  blocks: Block[];
  chatter: boolean;
  widgets: string[];
  names: string[];
};

export type ColumnSpec = { name: string; string?: string; widget?: string; invisible: string[] };

export type ListSpec = { create: boolean; remove: boolean; order?: string; columns: ColumnSpec[]; names: string[] };

export type FilterSpec = { key: string; name: string; string: string; domain: string; group: number; invisible?: string };

export type SearchSpec = { filters: FilterSpec[]; text: { name: string; string?: string; filterDomain?: string; operator?: string }[] };

const hidden = new Set(['1', 'True', 'true']);
const off = new Set(['0', 'false', 'False']);

function allowed(node: XmlNode, attribute: string): boolean {
  return !off.has(node.attrs[attribute] ?? '');
}

function classes(node: XmlNode): string[] {
  return (node.attrs.class ?? '').split(/\s+/).filter(Boolean);
}

function conditions(parent: string[], node: XmlNode): string[] | null {
  const own = node.attrs.invisible;
  if (own && hidden.has(own.trim())) return null;
  return own && !off.has(own.trim()) ? [...parent, own] : parent;
}

const identifier = /[A-Za-z_][A-Za-z0-9_]*/g;

function namesIn(expression: string | undefined, fields: Fields, into: Set<string>) {
  if (!expression) return;
  for (const match of expression.matchAll(identifier)) if (fields[match[0]]) into.add(match[0]);
}

function buttonOf(node: XmlNode, invisible: string[], key: string): ButtonSpec | null {
  const type = node.attrs.type;
  if (node.attrs.special || (type !== 'object' && type !== 'action') || !node.attrs.name) return null;
  const label = node.attrs.string || node.attrs.title || textOf(node);
  return {
    kind: 'button',
    key,
    name: node.attrs.name,
    type,
    string: label,
    invisible,
    primary: classes(node).some((name) => name === 'oe_highlight' || name === 'btn-primary'),
    confirm: node.attrs.confirm,
    context: node.attrs.context,
  };
}

function fieldOf(node: XmlNode, invisible: string[]): FieldSpec {
  return {
    kind: 'field',
    name: node.attrs.name,
    string: node.attrs.string,
    widget: node.attrs.widget,
    invisible,
    readonly: node.attrs.readonly,
    required: node.attrs.required,
    onChange: node.attrs.on_change === '1',
    context: node.attrs.context,
    domain: node.attrs.domain,
    options: node.attrs.options,
    placeholder: node.attrs.placeholder,
  };
}

const textTags = new Set(['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'strong', 'em', 'small', 'b', 'i']);

function hasControls(node: XmlNode): boolean {
  return elements(node).some((child) => child.tag === 'field' || child.tag === 'button' || hasControls(child));
}

export function compileForm(arch: string, fields: Fields): FormSpec {
  const root = parseXml(arch);
  const names = new Set<string>();
  const spec: FormSpec = {
    create: allowed(root, 'create'),
    edit: allowed(root, 'edit'),
    remove: allowed(root, 'delete'),
    header: [],
    smart: [],
    title: [],
    blocks: [],
    chatter: false,
    widgets: [],
    names: [],
  };
  let count = 0;
  const nextKey = (prefix: string) => `${prefix}${(count += 1)}`;
  let block: Block = { key: nextKey('b'), invisible: [], items: [] };
  spec.blocks.push(block);
  const open = (title: string | undefined, invisible: string[]) => {
    if (!block.title && !title && (!block.items.length || block.invisible.join('\n') === invisible.join('\n'))) {
      block.invisible = invisible;
      return;
    }
    block = { key: nextKey('b'), title, invisible, items: [] };
    spec.blocks.push(block);
  };
  const collect = (node: XmlNode) => {
    for (const attribute of ['invisible', 'readonly', 'required', 'column_invisible', 'context', 'domain']) namesIn(node.attrs[attribute], fields, names);
  };

  const walk = (node: XmlNode, invisible: string[], depth: number) => {
    for (const child of elements(node)) {
      collect(child);
      if (child.tag === 'field' && child.attrs.name) names.add(child.attrs.name);
      const shown = conditions(invisible, child);
      if (child.tag === 'chatter' || classes(child).includes('oe_chatter')) {
        spec.chatter = true;
        continue;
      }
      if (shown === null) {
        for (const nested of elements(child)) collectAll(nested);
        continue;
      }
      if (child.tag === 'header' || child.tag === 'footer') {
        for (const item of elements(child)) {
          collect(item);
          const own = conditions([], item);
          if (item.tag === 'field' && item.attrs.name) {
            names.add(item.attrs.name);
            if (item.attrs.widget === 'statusbar') spec.statusbar = { name: item.attrs.name, visible: (item.attrs.statusbar_visible ?? '').split(',').map((value) => value.trim()).filter(Boolean) };
          }
          if (item.tag === 'button' && own) {
            const button = buttonOf(item, own, nextKey('h'));
            if (button) spec.header.push(button);
          }
        }
        continue;
      }
      if (child.tag === 'div' && (child.attrs.name === 'button_box' || classes(child).includes('oe_button_box'))) {
        for (const item of elements(child)) {
          collect(item);
          const own = conditions(shown, item);
          for (const field of elements(item)) if (field.tag === 'field' && field.attrs.name) names.add(field.attrs.name);
          if (item.tag === 'button' && own) {
            const button = buttonOf(item, own, nextKey('s'));
            if (button) {
              const stat = elements(item).find((field) => field.tag === 'field');
              if (!button.string && stat) button.string = stat.attrs.string || fields[stat.attrs.name]?.string || '';
              spec.smart.push(button);
            }
          }
        }
        continue;
      }
      if (child.tag === 'widget') {
        if (child.attrs.name) spec.widgets.push(child.attrs.name);
        if (child.attrs.title) block.items.push({ kind: 'text', text: child.attrs.title, invisible: shown, tone: 'warn' });
        continue;
      }
      if (child.tag === 'div' && classes(child).includes('oe_title')) {
        for (const field of descendants(child, 'field')) {
          collect(field);
          names.add(field.attrs.name);
          const own = conditions(shown, field);
          if (own) spec.title.push(fieldOf(field, own));
        }
        continue;
      }
      if (child.tag === 'notebook') {
        for (const page of elements(child)) {
          collect(page);
          const own = conditions(shown, page);
          if (own === null) {
            collectAll(page);
            continue;
          }
          open(page.attrs.string, own);
          walk(page, own, depth + 1);
        }
        open(undefined, invisible);
        continue;
      }
      if (child.tag === 'group') {
        if (child.attrs.string || depth === 0) open(child.attrs.string, shown);
        walk(child, shown, depth + 1);
        continue;
      }
      if (child.tag === 'separator') {
        open(child.attrs.string, shown);
        continue;
      }
      if (child.tag === 'field' && child.attrs.name) {
        block.items.push(fieldOf(child, shown));
        continue;
      }
      if (child.tag === 'button') {
        const button = buttonOf(child, shown, nextKey('i'));
        if (button) block.items.push(button);
        continue;
      }
      if (child.tag === 'label') {
        if (!child.attrs.for && (child.attrs.string || textOf(child))) block.items.push({ kind: 'text', text: child.attrs.string || textOf(child), invisible: shown, tone: 'plain' });
        continue;
      }
      if (child.tag === 'list' || child.tag === 'kanban' || child.tag === 'form' || child.tag === 'templates') continue;
      const alert = classes(child).find((name) => name.startsWith('alert-'));
      if (alert || (textTags.has(child.tag) && !hasControls(child))) {
        const text = textOf(child);
        if (text) {
          const tone = alert === 'alert-danger' ? 'danger' : alert === 'alert-warning' ? 'warn' : alert ? 'info' : 'plain';
          block.items.push({ kind: 'text', text, invisible: shown, tone });
        }
        continue;
      }
      walk(child, shown, depth);
    }
  };

  const collectAll = (node: XmlNode) => {
    collect(node);
    if (node.tag === 'field' && node.attrs.name) names.add(node.attrs.name);
    if (node.tag === 'field') return;
    for (const child of elements(node)) collectAll(child);
  };

  const sheet = elements(root).find((child) => child.tag === 'sheet');
  for (const child of elements(root)) {
    if (child.tag === 'sheet') continue;
    walk({ tag: '#', attrs: {}, children: [child] }, [], 0);
  }
  if (sheet) walk(sheet, [], 0);
  spec.blocks = spec.blocks.filter((item) => item.items.length);
  spec.names = [...names].filter((name) => fields[name]);
  return spec;
}

function descendants(node: XmlNode, tag: string): XmlNode[] {
  return elements(node).flatMap((child) => (child.tag === tag ? [child] : descendants(child, tag)));
}

export function compileList(arch: string, fields: Fields): ListSpec {
  const root = parseXml(arch);
  const names = new Set<string>();
  const columns: ColumnSpec[] = [];
  for (const child of elements(root)) {
    if (child.tag !== 'field' || !child.attrs.name || !fields[child.attrs.name]) continue;
    names.add(child.attrs.name);
    namesIn(child.attrs.invisible, fields, names);
    if (hidden.has((child.attrs.column_invisible ?? '').trim()) || hidden.has((child.attrs.invisible ?? '').trim())) continue;
    if (child.attrs.widget === 'handle') continue;
    columns.push({ name: child.attrs.name, string: child.attrs.string, widget: child.attrs.widget, invisible: child.attrs.invisible && !off.has(child.attrs.invisible) ? [child.attrs.invisible] : [] });
  }
  return { create: allowed(root, 'create'), remove: allowed(root, 'delete'), order: root.attrs.default_order, columns, names: [...names] };
}

export function compileSearch(arch: string): SearchSpec {
  const root = parseXml(arch);
  const filters: FilterSpec[] = [];
  const text: SearchSpec['text'] = [];
  let group = 0;
  let count = 0;
  const walk = (node: XmlNode) => {
    for (const child of elements(node)) {
      if (child.tag === 'separator') group += 1;
      else if (child.tag === 'group') {
        group += 1;
        walk(child);
        group += 1;
      } else if (child.tag === 'filter' && child.attrs.domain && !/group_by/.test(child.attrs.context ?? '')) {
        filters.push({ key: `f${(count += 1)}`, name: child.attrs.name ?? '', string: child.attrs.string ?? child.attrs.name ?? '', domain: child.attrs.domain, group, invisible: child.attrs.invisible });
      } else if (child.tag === 'field' && child.attrs.name && !hidden.has(child.attrs.invisible ?? '')) {
        text.push({ name: child.attrs.name, string: child.attrs.string, filterDomain: child.attrs.filter_domain, operator: child.attrs.operator });
      }
    }
  };
  walk(root);
  return { filters, text };
}

export function titleColumn(list: ListSpec): string {
  return list.columns.find((column) => column.name === 'name')?.name ?? list.columns.find((column) => column.name === 'display_name')?.name ?? 'display_name';
}
