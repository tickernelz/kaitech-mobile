import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { ESLint } from 'eslint';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const design = createRequire(import.meta.url)('../lint/design.js');

function keyOf(node) {
  return node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : null;
}

async function measure() {
  const eslint = new ESLint({
    cwd: root,
    ruleFilter: ({ ruleId }) => ruleId.startsWith('design/'),
    overrideConfig: {
      files: ['src/**/*.{ts,tsx}'],
      ignores: ['src/theme/**'],
      plugins: { design: design.plugin },
      rules: Object.fromEntries(Object.keys(design.plugin.rules).map((rule) => ['design/' + rule, ['error', { exceptions: false }]])),
    },
  });
  const rows = new Map(Object.entries(design.plugin.rules).flatMap(([rule, { meta }]) => Object.keys(meta.messages).filter((id) => id !== 'stale').map((id) => [rule + ':' + id, []])));
  for (const result of await eslint.lintFiles(['src'])) {
    for (const message of result.messages) rows.get(message.ruleId.slice('design/'.length) + ':' + message.messageId).push(relative(root, result.filePath) + ':' + message.line + ' ' + message.message);
  }
  return rows;
}

function tokenPairs(platform) {
  const file = join(root, 'src/theme/tokens.ts');
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const objects = {};
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ['pairs', 'accents'].includes(node.name.getText())) objects[node.name.getText()] = ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  const accent = objects.accents.properties.find((prop) => keyOf(prop) === platform).initializer;
  const pairs = {};
  for (const prop of [...objects.pairs.properties.filter((p) => !ts.isSpreadAssignment(p)), ...accent.properties]) pairs[keyOf(prop)] = prop.initializer.elements.map((e) => e.text);
  return pairs;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const contrastChecks = [
  ...['ink', 'inkSoft', 'inkFaint', 'link', 'dangerInk', 'okInk', 'warnInk', 'infoInk'].flatMap((fg) => ['canvas', 'surface', 'surface2'].map((bg) => [fg, bg, 4.5])),
  ...['primary', 'danger', 'ok', 'edge', 'focus'].flatMap((fg) => ['canvas', 'surface', 'surface2'].map((bg) => [fg, bg, 3])),
  ['selectInk', 'select', 4.5],
  ['onPrimary', 'primary', 4.5],
  ['onPrimary', 'primaryPressed', 3],
  ['okInk', 'okBand', 4.5],
  ['warnInk', 'warnBand', 4.5],
  ['dangerInk', 'dangerBand', 4.5],
  ['infoInk', 'infoBand', 4.5],
  ['onDanger', 'dangerInk', 4.5],
  ['onFill', 'danger', 3],
  ['canvas', 'dangerInk', 4.5],
];

if (args.has('--contrast')) {
  for (const platform of ['android', 'ios']) {
    const pairs = tokenPairs(platform);
    console.log((platform === 'android' ? 'Android' : 'iOS') + '\n');
    console.log('| Foreground | Background | Minimum | Light | Dark |');
    console.log('|---|---|---|---|---|');
    for (const [fg, bg, min] of contrastChecks) {
      const cells = [0, 1].map((i) => {
        const ratio = contrast(pairs[fg][i], pairs[bg][i]);
        return ratio.toFixed(2) + (ratio < min ? ' FAIL' : '');
      });
      console.log('| ' + fg + ' | ' + bg + ' | ' + min + ' | ' + cells.join(' | ') + ' |');
    }
    console.log('');
  }
} else {
  const rows = await measure();
  console.log('| Rule | Message | Count | Meaning |');
  console.log('|---|---|---|---|');
  for (const [row, hits] of rows) {
    const [rule, id] = row.split(':');
    console.log('| design/' + rule + ' | ' + id + ' | ' + hits.length + ' | ' + design.plugin.rules[rule].meta.docs.description + ' |');
  }
  if (args.has('--list')) for (const [row, hits] of rows) for (const line of hits) console.log('design/' + row + ' ' + line);
}
