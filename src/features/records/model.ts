import { parseServerDate } from '../discovery/dates';
import type { FieldInfo, Fields, Relation } from './api';
import { condition, literal, type PyContext } from './py';
import type { FieldSpec } from './views';

export type Values = Record<string, unknown>;

export function isRelation(value: unknown): value is Relation {
  return !!value && typeof value === 'object' && !Array.isArray(value) && typeof (value as Relation).id === 'number';
}

export function scopeOf(values: Values, fields: Fields, context: Record<string, unknown>, uid: number): PyContext {
  const scope: PyContext = { context, uid, id: values.id ?? false, active_id: context.active_id ?? false };
  for (const name of Object.keys(fields)) {
    const value = values[name];
    if (value === undefined) scope[name] = fields[name].type.endsWith('2many') ? [] : false;
    else scope[name] = isRelation(value) ? value.id : value === null ? false : value;
  }
  return scope;
}

export function visible(invisible: string[], scope: PyContext): boolean {
  return invisible.every((source) => !condition(source, scope, true));
}

export function editable(field: FieldSpec, info: FieldInfo | undefined, scope: PyContext): boolean {
  if (!info) return false;
  if (field.readonly !== undefined) return !condition(field.readonly, scope, true);
  if (['one2many', 'binary'].includes(info.type) && field.widget !== 'many2many_binary') return false;
  return !info.readonly;
}

export function required(field: FieldSpec, info: FieldInfo | undefined, scope: PyContext): boolean {
  if (field.required !== undefined) return condition(field.required, scope, false);
  return !!info?.required;
}

export function contextOf(source: unknown, scope: PyContext): Record<string, unknown> {
  if (source && typeof source === 'object' && !Array.isArray(source)) return source as Record<string, unknown>;
  if (typeof source !== 'string') return {};
  const value = literal<unknown>(source, scope, {});
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function domainOf(source: unknown, scope: PyContext): unknown[] {
  if (Array.isArray(source)) return source;
  if (typeof source !== 'string') return [];
  const value = literal<unknown>(source, scope, []);
  return Array.isArray(value) ? value : [];
}

export function emptyValue(info: FieldInfo): unknown {
  if (info.type.endsWith('2many')) return [];
  if (info.type === 'boolean') return false;
  return false;
}

export function writeValue(info: FieldInfo, value: unknown): unknown {
  if (info.type === 'many2one') return isRelation(value) ? value.id : value || false;
  if (info.type === 'many2many') return [[6, 0, Array.isArray(value) ? value.map((item) => (isRelation(item) ? item.id : item)) : []]];
  if (value === '' && info.type !== 'char' && info.type !== 'text' && info.type !== 'html') return false;
  return value;
}

export function changedValues(before: Values, after: Values, fields: Fields): Values {
  const out: Values = {};
  for (const name of Object.keys(after)) {
    const info = fields[name];
    if (!info || name === 'id') continue;
    if (JSON.stringify(normalized(before[name])) !== JSON.stringify(normalized(after[name]))) out[name] = writeValue(info, after[name]);
  }
  return out;
}

function normalized(value: unknown): unknown {
  if (isRelation(value)) return value.id;
  if (Array.isArray(value)) return value.map(normalized);
  return value ?? false;
}

export function onchangeValues(values: Values, fields: Fields): Values {
  const out: Values = {};
  for (const [name, value] of Object.entries(values)) {
    const info = fields[name];
    if (!info) continue;
    if (info.type === 'many2one') out[name] = isRelation(value) ? value.id : value || false;
    else if (info.type.endsWith('2many')) out[name] = Array.isArray(value) ? [[6, 0, value.map((item) => (isRelation(item) ? item.id : item))]] : [];
    else out[name] = value ?? false;
  }
  return out;
}

export function mergeOnchange(values: Values, change: Values, fields: Fields): Values {
  const out = { ...values };
  for (const [name, value] of Object.entries(change)) {
    const info = fields[name];
    if (!info) continue;
    if (info.type.endsWith('2many') && !Array.isArray(value)) continue;
    if (info.type.endsWith('2many')) out[name] = (value as unknown[]).filter((item) => typeof item === 'number' || isRelation(item));
    else out[name] = value;
  }
  return out;
}

const htmlTags = /<[^>]+>/g;

export function plainOfHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(htmlTags, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function htmlOfPlain(text: string): string {
  const escape = (line: string) => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.split('\n').map(escape).join('<br>')}</p>`)
    .join('');
}

export type Format = { number: (value: number) => string; date: (value: Date) => string; day: (value: Date) => string; yes: string; no: string };

export function textOfValue(info: FieldInfo | undefined, value: unknown, format: Format, widget?: string): string {
  if (!info || value === undefined || value === null) return '';
  switch (info.type) {
    case 'boolean':
      return value ? format.yes : format.no;
    case 'many2one':
    case 'reference':
      return isRelation(value) ? value.display_name : '';
    case 'selection':
      return info.selection?.find(([key]) => key === value)?.[1] ?? (value ? String(value) : '');
    case 'integer':
    case 'float':
    case 'monetary':
      if (typeof value !== 'number') return '';
      return widget === 'percentage' ? `${format.number(Math.round(value * 1000) / 10)}%` : format.number(value);
    case 'date': {
      const day = typeof value === 'string' ? new Date(`${value}T00:00:00`) : null;
      return day && !Number.isNaN(day.getTime()) ? format.day(day) : '';
    }
    case 'datetime': {
      const at = typeof value === 'string' ? parseServerDate(value) : null;
      return at ? format.date(at) : '';
    }
    case 'html':
      return typeof value === 'string' ? plainOfHtml(value) : '';
    case 'one2many':
    case 'many2many':
      return Array.isArray(value) ? String(value.length) : '';
    case 'binary':
      return value ? String(value) : '';
    default:
      return value === false ? '' : String(value);
  }
}

export function fieldLabel(field: { name: string; string?: string }, fields: Fields): string {
  return field.string || fields[field.name]?.string || field.name;
}
