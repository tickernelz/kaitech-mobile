import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';

const root = join(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));

const scale = {
  space: [0, 2, 4, 8, 12, 16, 24, 32, 40],
  radius: [4, 6, 8, 10, 12, 14, 16, 28, 999],
  fontSize: [11, 12, 13, 14, 15, 16, 17, 22, 28, 32, 34, 48, 64],
  lineHeight: [16, 18, 20, 22, 24, 28, 40],
  leading: [1.18, 1.5],
  iconSize: [16, 20, 24, 32, 48],
  duration: [0, 120, 180, 240, 300, 320, 600],
  elevation: [0, 1, 3, 6, 8, 12],
};

const colorContent = ['src/features/appearance/appearance.ts', 'src/features/appearance/wallpapers/presets.ts', 'src/ui/icons/index.tsx'];
const spacing = /^(padding|margin)(Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?$|^(gap|rowGap|columnGap)$/;
const radiusKey = /^border(TopLeft|TopRight|BottomLeft|BottomRight|TopStart|TopEnd|BottomStart|BottomEnd)?Radius$/;
const widthKey = /^border(Top|Bottom|Left|Right|Start|End)?Width$/;
const colorText = /^#[0-9a-f]{3,8}$|^(rgb|rgba|hsl|hsla)\(/i;

const rules = {
  'color-literal': 'colour literal outside src/theme',
  'font-size-literal': 'fontSize literal',
  'font-size-off-scale': 'fontSize literal off the type scale',
  'line-height-off-scale': 'lineHeight literal not a token line height and outside 1.18 to 1.5 times its fontSize',
  'radius-literal': 'border radius literal',
  'radius-off-scale': 'border radius off the radius scale and not half of the element size',
  'spacing-literal': 'padding, margin or gap literal other than 0 or 2',
  'spacing-off-scale': 'padding, margin or gap literal off the spacing scale',
  'hairline-on-curve': 'StyleSheet.hairlineWidth border in a style object that also sets a border radius',
  'ripple-unclipped': 'Pressable whose own style sets a border radius but not overflow hidden, so the Android ripple can paint past the curve',
  'icon-size-off-scale': 'Icon size literal off the optical sizes',
  'duration-off-scale': 'animation duration literal off the motion scale',
  'elevation-off-scale': 'elevation literal off the elevation levels',
};

const hits = Object.fromEntries(Object.keys(rules).map((rule) => [rule, []]));

function sources(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

function keyOf(node) {
  return node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)) ? node.name.text : null;
}

function numberOf(node) {
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  return null;
}

function scan(file) {
  const path = relative(root, file);
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const hit = (rule, node, value) => hits[rule].push(path + ':' + (source.getLineAndCharacterOfPosition(node.getStart()).line + 1) + ' ' + value);

  function objectRules(node) {
    const props = node.properties.filter(ts.isPropertyAssignment);
    const sizes = props.filter((p) => ['width', 'height'].includes(keyOf(p))).map((p) => numberOf(p.initializer)).filter((n) => n !== null);
    const curved = props.some((p) => radiusKey.test(keyOf(p) ?? ''));
    const fontSize = props.filter((p) => keyOf(p) === 'fontSize').map((p) => numberOf(p.initializer)).find((n) => n !== null);
    for (const prop of props) {
      const key = keyOf(prop);
      if (!key) continue;
      const value = numberOf(prop.initializer);
      if (widthKey.test(key) && curved && prop.initializer.getText() === 'StyleSheet.hairlineWidth') hit('hairline-on-curve', prop, key);
      if (value === null) continue;
      if (key === 'fontSize') {
        hit('font-size-literal', prop, value);
        if (!scale.fontSize.includes(value)) hit('font-size-off-scale', prop, value);
      }
      const leading = fontSize ? value / fontSize : 0;
      if (key === 'lineHeight' && !scale.lineHeight.includes(value) && !(leading >= scale.leading[0] && leading <= scale.leading[1])) hit('line-height-off-scale', prop, value);
      if (radiusKey.test(key)) {
        hit('radius-literal', prop, value);
        if (!scale.radius.includes(value) && !sizes.some((size) => size === value * 2)) hit('radius-off-scale', prop, value);
      }
      if (spacing.test(key) && !scale.space.includes(Math.abs(value))) hit('spacing-off-scale', prop, value);
      if (spacing.test(key) && ![0, 2].includes(Math.abs(value))) hit('spacing-literal', prop, value);
      if (key === 'duration' && !scale.duration.includes(value)) hit('duration-off-scale', prop, value);
      if (key === 'elevation' && !scale.elevation.includes(value)) hit('elevation-off-scale', prop, value);
    }
  }

  const sheets = new Map();
  function collect(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText() === 'StyleSheet.create') {
      const object = node.initializer.arguments[0];
      if (object && ts.isObjectLiteralExpression(object)) {
        const entries = new Map();
        for (const prop of object.properties) if (ts.isPropertyAssignment(prop) && ts.isObjectLiteralExpression(prop.initializer)) entries.set(keyOf(prop), shapeOf(prop.initializer));
        sheets.set(node.name.getText(), entries);
      }
    }
    ts.forEachChild(node, collect);
  }
  collect(source);

  function shapeOf(object) {
    const props = object.properties.filter(ts.isPropertyAssignment);
    return {
      curved: props.some((p) => radiusKey.test(keyOf(p) ?? '') && numberOf(p.initializer) !== 0),
      clipped: props.some((p) => keyOf(p) === 'overflow' && p.initializer.getText().includes('hidden')),
    };
  }

  function styleShapes(expression) {
    const shapes = [];
    function walk(node) {
      if (ts.isObjectLiteralExpression(node)) shapes.push(shapeOf(node));
      else if (ts.isPropertyAccessExpression(node) && sheets.has(node.expression.getText())) {
        const shape = sheets.get(node.expression.getText()).get(node.name.text);
        if (shape) shapes.push(shape);
      } else ts.forEachChild(node, walk);
    }
    walk(expression);
    return shapes;
  }

  function rippleRule(node) {
    const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
    const style = attrs.find((a) => a.name.getText() === 'style');
    if (!style?.initializer || !ts.isJsxExpression(style.initializer) || !style.initializer.expression) return;
    if (attrs.some((a) => a.name.getText() === 'android_ripple' && a.getText().includes('borderless: true'))) return;
    const shapes = styleShapes(style.initializer.expression);
    if (shapes.some((s) => s.curved) && !shapes.some((s) => s.clipped)) hit('ripple-unclipped', node, 'Pressable');
  }

  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) objectRules(node);
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText() === 'Pressable') rippleRule(node);
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && colorText.test(node.text) && !colorContent.includes(path)) hit('color-literal', node, node.text);
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText() === 'Icon') {
      for (const attr of node.attributes.properties) {
        if (!ts.isJsxAttribute(attr) || attr.name.getText() !== 'size' || !attr.initializer || !ts.isJsxExpression(attr.initializer) || !attr.initializer.expression) continue;
        const value = numberOf(attr.initializer.expression);
        if (value !== null && !scale.iconSize.includes(value)) hit('icon-size-off-scale', attr, value);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

for (const file of sources(join(root, 'src'))) if (!relative(root, file).startsWith('src/theme/')) scan(file);

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
  ['onDanger', 'danger', 4.5],
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
  console.log('| Rule | Count | Meaning |');
  console.log('|---|---|---|');
  for (const [rule, meaning] of Object.entries(rules)) console.log('| ' + rule + ' | ' + hits[rule].length + ' | ' + meaning + ' |');
  if (args.has('--list')) for (const [rule, list] of Object.entries(hits)) for (const line of list) console.log(rule + ' ' + line);
}
