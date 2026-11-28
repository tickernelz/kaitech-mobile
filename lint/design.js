const path = require('node:path');

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

const colourContent = ['src/features/appearance/appearance.ts', 'src/features/appearance/wallpapers/presets.ts', 'src/ui/icons/index.tsx'];
const spacingKey = /^(padding|margin)(Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?$|^(gap|rowGap|columnGap)$/;
const radiusKey = /^border(TopLeft|TopRight|BottomLeft|BottomRight|TopStart|TopEnd|BottomStart|BottomEnd)?Radius$/;
const colourText = /^#[0-9a-f]{3,8}$|^(rgb|rgba|hsl|hsla)\(/i;

const exceptionsFile = 'lint/design-exceptions.js';

function keyOf(property) {
  if (property.type !== 'Property' || property.computed) return null;
  if (property.key.type === 'Identifier') return property.key.name;
  return property.key.type === 'Literal' && typeof property.key.value === 'string' ? property.key.value : null;
}

function numberOf(node) {
  if (node.type === 'Literal' && typeof node.value === 'number') return node.value;
  if (node.type === 'UnaryExpression' && node.operator === '-' && node.argument.type === 'Literal' && typeof node.argument.value === 'number') return -node.argument.value;
  return null;
}

function stringOf(node) {
  if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

function literalProps(object) {
  return object.properties.map((property) => ({ property, key: keyOf(property), value: keyOf(property) ? numberOf(property.value) : null })).filter((entry) => entry.key);
}

const repository = path.dirname(__dirname);

function fileOf(context) {
  return path.relative(repository, context.physicalFilename).split(path.sep).join('/');
}

function guarded(name, description, messages, collect) {
  return {
    meta: {
      type: 'problem',
      docs: { description },
      schema: [{ type: 'object', properties: { exceptions: { type: 'boolean' } }, additionalProperties: false }],
      messages: { ...messages, stale: 'The exception {{value}} for design/' + name + ' no longer matches this file: remove it from ' + exceptionsFile + '.' },
    },
    create(context) {
      const allowed = context.options[0]?.exceptions === false ? [] : [...(context.settings.designExceptions?.[fileOf(context)]?.[name] ?? [])];
      const hits = [];
      const visitors = collect((node, messageId, value) => hits.push({ node, messageId, value }), context);
      const exit = visitors['Program:exit'];
      return {
        ...visitors,
        'Program:exit'(program) {
          exit?.(program);
          for (const { node, messageId, value } of hits) {
            const at = allowed.indexOf(value);
            if (at >= 0) allowed.splice(at, 1);
            else context.report({ node, messageId, data: { value: String(value) } });
          }
          for (const value of allowed) context.report({ loc: { line: 1, column: 0 }, messageId: 'stale', data: { value: String(value) } });
        },
      };
    },
  };
}

function onObjects(check) {
  return (report) => ({ ObjectExpression: (object) => check(literalProps(object), report) });
}

function jsxName(node) {
  return node.name.type === 'JSXIdentifier' ? node.name.name : null;
}

function attribute(element, name) {
  return element.attributes.find((attr) => attr.type === 'JSXAttribute' && attr.name.name === name);
}

function walk(node, keys, visit) {
  if (!node || typeof node.type !== 'string' || visit(node) === false) return;
  for (const key of keys[node.type] ?? []) for (const child of [node[key]].flat()) walk(child, keys, visit);
}

function shapeOf(object) {
  const props = literalProps(object);
  return {
    curved: props.some(({ key, value }) => radiusKey.test(key) && value !== 0),
    clipped: object.properties.some((property) => keyOf(property) === 'overflow' && property.value.type === 'Literal' && property.value.value === 'hidden'),
  };
}

function boundedRipple(expression) {
  if (expression.type !== 'ObjectExpression') return true;
  return expression.properties.some((property) => keyOf(property) === 'radius' || (keyOf(property) === 'borderless' && property.value.type === 'Literal' && property.value.value === true));
}

const rules = {
  spacing: guarded(
    'spacing',
    'padding, margin and gap use space.*, 2 or 0',
    {
      literal: 'Spacing literal {{value}}: use space.* from src/theme (2 and 0 are the only literals allowed).',
      offScale: 'Spacing literal {{value}} is off the spacing scale: use space.* from src/theme.',
    },
    onObjects((props, report) => {
      for (const { property, key, value } of props) {
        if (value === null || !spacingKey.test(key) || [0, 2].includes(Math.abs(value))) continue;
        report(property, scale.space.includes(Math.abs(value)) ? 'literal' : 'offScale', value);
      }
    }),
  ),
  radius: guarded(
    'radius',
    'a border radius literal is on the radius scale or half the element size',
    { offScale: 'Border radius {{value}} is off the radius scale and not half of this element: use radius.* from src/theme.' },
    onObjects((props, report) => {
      const sides = props.filter(({ key }) => key === 'width' || key === 'height').map(({ value }) => value);
      for (const { property, key, value } of props) {
        if (value !== null && radiusKey.test(key) && !scale.radius.includes(value) && !sides.includes(value * 2)) report(property, 'offScale', value);
      }
    }),
  ),
  'font-size': guarded(
    'font-size',
    'a fontSize literal is on the type scale',
    { offScale: 'fontSize {{value}} is off the type scale: use a Text variant or a size from docs/design-quality.md.' },
    onObjects((props, report) => {
      for (const { property, key, value } of props) if (key === 'fontSize' && value !== null && !scale.fontSize.includes(value)) report(property, 'offScale', value);
    }),
  ),
  'line-height': guarded(
    'line-height',
    'a lineHeight literal is a token line height or 1.18 to 1.5 times its fontSize',
    { offScale: 'lineHeight {{value}} is neither a token line height nor 1.18 to 1.5 times its fontSize.' },
    onObjects((props, report) => {
      const fontSize = props.find(({ key, value }) => key === 'fontSize' && value !== null)?.value;
      for (const { property, key, value } of props) {
        if (key !== 'lineHeight' || value === null || scale.lineHeight.includes(value)) continue;
        const leading = fontSize ? value / fontSize : 0;
        if (leading < scale.leading[0] || leading > scale.leading[1]) report(property, 'offScale', value);
      }
    }),
  ),
  elevation: guarded(
    'elevation',
    'an elevation literal is one of the elevation levels',
    { offScale: 'elevation {{value}} is off the elevation levels (0, 1, 3, 6, 8, 12).' },
    onObjects((props, report) => {
      for (const { property, key, value } of props) if (key === 'elevation' && value !== null && !scale.elevation.includes(value)) report(property, 'offScale', value);
    }),
  ),
  duration: guarded(
    'duration',
    'a duration literal is on the motion scale',
    { offScale: 'duration {{value}} is off the motion scale: use duration.* from src/theme/motion.' },
    onObjects((props, report) => {
      for (const { property, key, value } of props) if (key === 'duration' && value !== null && !scale.duration.includes(value)) report(property, 'offScale', value);
    }),
  ),
  colour: guarded(
    'colour',
    'colours come from src/theme',
    { literal: 'Colour literal {{value}}: take the colour from a token in src/theme.' },
    (report, context) => {
      if (colourContent.includes(fileOf(context))) return {};
      const check = (node) => {
        const text = stringOf(node);
        if (text !== null && colourText.test(text)) report(node, 'literal', text);
      };
      return { Literal: check, TemplateLiteral: check };
    },
  ),
  'icon-size': guarded(
    'icon-size',
    'an Icon size literal is one of the optical sizes',
    { offScale: 'Icon size {{value}} is off the optical sizes (16, 20, 24, 32, 48).' },
    (report) => ({
      JSXOpeningElement(element) {
        const size = jsxName(element) === 'Icon' && attribute(element, 'size');
        const value = size?.value?.type === 'JSXExpressionContainer' ? numberOf(size.value.expression) : null;
        if (value !== null && !scale.iconSize.includes(value)) report(size, 'offScale', value);
      },
    }),
  ),
  ripple: guarded(
    'ripple',
    'an explicit android_ripple on a rounded Pressable is bounded or clipped',
    { unbounded: 'This android_ripple replaces the bounded ripple of src/ui/Pressable and paints a square on the rounded style: drop it, give it a radius, or clip the Pressable with overflow hidden.' },
    (report, context) => {
      const sheets = new Map();
      const pending = [];
      const keys = context.sourceCode.visitorKeys;
      const shapes = (expression) => {
        const found = [];
        walk(expression, keys, (node) => {
          if (node.type === 'ObjectExpression') {
            found.push(shapeOf(node));
            return false;
          }
          if (node.type === 'MemberExpression' && node.object.type === 'Identifier' && sheets.has(node.object.name) && node.property.type === 'Identifier') {
            const shape = sheets.get(node.object.name).get(node.property.name);
            if (shape) found.push(shape);
            return false;
          }
          return true;
        });
        return found;
      };
      return {
        VariableDeclarator(declarator) {
          const init = declarator.init;
          const isSheet = init?.type === 'CallExpression' && context.sourceCode.getText(init.callee) === 'StyleSheet.create' && init.arguments[0]?.type === 'ObjectExpression';
          if (!isSheet || declarator.id.type !== 'Identifier') return;
          const entries = new Map();
          for (const property of init.arguments[0].properties) if (keyOf(property) && property.value.type === 'ObjectExpression') entries.set(keyOf(property), shapeOf(property.value));
          sheets.set(declarator.id.name, entries);
        },
        JSXOpeningElement(element) {
          const ripple = attribute(element, 'android_ripple');
          const style = attribute(element, 'style');
          if (jsxName(element) !== 'Pressable' || ripple?.value?.type !== 'JSXExpressionContainer' || style?.value?.type !== 'JSXExpressionContainer') return;
          if (!boundedRipple(ripple.value.expression)) pending.push({ ripple, style: style.value.expression });
        },
        'Program:exit'() {
          for (const { ripple, style } of pending) {
            const found = shapes(style);
            if (found.some((shape) => shape.curved) && !found.some((shape) => shape.clipped)) report(ripple, 'unbounded', 'android_ripple');
          }
        },
      };
    },
  ),
};

module.exports = { plugin: { meta: { name: 'design' }, rules } };
