export type Catalog = { [key: string]: string | Catalog };

export type ParityProblem =
  | { kind: 'missing'; key: string; language: string }
  | { kind: 'empty'; key: string; language: string }
  | { kind: 'not-string'; key: string; language: string }
  | { kind: 'placeholders'; key: string; language: string; expected: string[]; actual: string[] };

function flatten(value: unknown, prefix: string, out: Map<string, unknown>): void {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return;
  }
  out.set(prefix, value);
}

function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(/{{\s*([\w.]+)\s*}}/g)].map((m) => m[1]))].sort();
}

export function catalogParity(catalogs: Record<string, unknown>): ParityProblem[] {
  const flat = new Map<string, Map<string, unknown>>();
  for (const [language, catalog] of Object.entries(catalogs)) {
    const entries = new Map<string, unknown>();
    flatten(catalog, '', entries);
    flat.set(language, entries);
  }
  const allKeys = new Set<string>();
  for (const entries of flat.values()) for (const key of entries.keys()) allKeys.add(key);

  const problems: ParityProblem[] = [];
  for (const key of [...allKeys].sort()) {
    let reference: string[] | undefined;
    for (const [language, entries] of flat) {
      if (!entries.has(key)) {
        problems.push({ kind: 'missing', key, language });
        continue;
      }
      const value = entries.get(key);
      if (typeof value !== 'string') {
        problems.push({ kind: 'not-string', key, language });
        continue;
      }
      if (value.trim() === '') {
        problems.push({ kind: 'empty', key, language });
        continue;
      }
      const found = placeholders(value);
      if (reference === undefined) {
        reference = found;
      } else if (found.join(',') !== reference.join(',')) {
        problems.push({ kind: 'placeholders', key, language, expected: reference, actual: found });
      }
    }
  }
  return problems;
}
