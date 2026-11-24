import { literal } from './py';
import type { FilterSpec, SearchSpec } from './views';

const always = [1, '=', 1];

export function normalize(domain: unknown[]): unknown[] {
  if (!domain.length) return [always];
  const result: unknown[] = [];
  let expected = 1;
  for (const token of domain) {
    if (expected === 0) {
      result.unshift('&');
      expected = 1;
    }
    if (token === '&' || token === '|') expected += 1;
    else if (token !== '!') expected -= 1;
    result.push(token);
  }
  return result;
}

function combine(operator: '&' | '|', domains: unknown[][]): unknown[] {
  const kept = domains.filter((domain) => domain.length);
  if (!kept.length) return [];
  if (kept.length === 1) return kept[0];
  return [...Array<string>(kept.length - 1).fill(operator), ...kept.flatMap(normalize)];
}

export const andDomains = (domains: unknown[][]) => combine('&', domains);
export const orDomains = (domains: unknown[][]) => combine('|', domains);

export function filtersDomain(filters: FilterSpec[], active: Set<string>, scope: Record<string, unknown>): unknown[] {
  const groups = new Map<number, unknown[][]>();
  for (const filter of filters) {
    if (!active.has(filter.key)) continue;
    const domain = literal<unknown>(filter.domain, scope, null);
    if (!Array.isArray(domain)) continue;
    groups.set(filter.group, [...(groups.get(filter.group) ?? []), domain]);
  }
  return andDomains([...groups.values()].map(orDomains));
}

export function textDomain(search: SearchSpec | null, text: string, scope: Record<string, unknown>): unknown[] {
  const said = text.trim();
  if (!said) return [];
  const field = search?.text[0];
  if (!field) return [['display_name', 'ilike', said]];
  if (field.filterDomain) {
    const domain = literal<unknown>(field.filterDomain, { ...scope, self: said, raw_value: said }, null);
    if (Array.isArray(domain)) return domain;
  }
  return [[field.name, field.operator || 'ilike', said]];
}

export function defaultFilters(filters: FilterSpec[], context: Record<string, unknown>): Set<string> {
  return new Set(filters.filter((filter) => filter.name && context[`search_default_${filter.name}`]).map((filter) => filter.key));
}
