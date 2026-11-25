import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const app = join(__dirname, '..', 'src', 'app');

function layouts(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return layouts(path);
    return entry === '_layout.tsx' ? [path] : [];
  });
}

function modalRoutes(layout: string): { name: string; file: string }[] {
  const dir = join(layout, '..');
  const source = readFileSync(layout, 'utf8');
  return [...source.matchAll(/<Stack\.Screen\s+name="([^"]+)"\s+options=\{\{[^}]*presentation:\s*'(?:modal|fullScreenModal|formSheet|transparentModal|containedModal)'/g)].map(([, name]) => {
    const candidates = [join(dir, `${name}.tsx`), join(dir, name, '_layout.tsx'), join(dir, name, 'index.tsx')];
    return { name: join(dir, name).slice(app.length + 1), file: candidates.find(existsSync) ?? candidates[0] };
  });
}

const routes = layouts(app).flatMap(modalRoutes);

describe('native modal routes', () => {
  it('finds the modal routes of every stack', () => {
    expect(routes.map((route) => route.name)).toEqual(expect.arrayContaining(['settings', 'call/[id]', 'mom/record', 'mom/followup/new']));
  });

  it.each(routes.map((route) => [route.name, route.file]))('%s mounts its own dialog layer, so iOS presents dialogs over it', (_name, file) => {
    expect(readFileSync(file, 'utf8')).toMatch(/<DialogLayer\s*\/>/);
  });
});
