import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { catalogParity } from '../src/i18n/catalog-parity';

const LANGUAGES = ['en', 'id'] as const;
const ROOT = join(__dirname, '..', 'src', 'i18n');

function catalogDirectories(dir: string): string[] {
  const found: string[] = [];
  const names = readdirSync(dir);
  if (LANGUAGES.some((language) => names.includes(`${language}.json`))) found.push(dir);
  for (const name of names) {
    const child = join(dir, name);
    if (statSync(child).isDirectory()) found.push(...catalogDirectories(child));
  }
  return found;
}

const directories = catalogDirectories(ROOT);

describe('translation catalogs', () => {
  it('exist', () => {
    expect(directories.length).toBeGreaterThan(0);
  });

  it.each(directories.map((dir) => [relative(ROOT, dir) || '.', dir]))(
    '%s has identical en and id keys',
    (_name, dir) => {
      const catalogs: Record<string, unknown> = {};
      const absent: string[] = [];
      for (const language of LANGUAGES) {
        const file = join(dir, `${language}.json`);
        try {
          catalogs[language] = JSON.parse(readFileSync(file, 'utf8'));
        } catch {
          absent.push(`${language}.json`);
        }
      }
      expect(absent).toEqual([]);
      expect(catalogParity(catalogs)).toEqual([]);
    },
  );
});
