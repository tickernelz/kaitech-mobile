import { loadYoga, Align, Direction, Display, Edge, FlexDirection, Gutter, Justify, MeasureMode, PositionType, Wrap } from 'yoga-layout/load';

const charWidth = 8;
const lineHeight = 20;
const enums = {
  flexDirection: { row: FlexDirection.Row, column: FlexDirection.Column, 'row-reverse': FlexDirection.RowReverse, 'column-reverse': FlexDirection.ColumnReverse },
  align: { auto: Align.Auto, 'flex-start': Align.FlexStart, center: Align.Center, 'flex-end': Align.FlexEnd, stretch: Align.Stretch, baseline: Align.Baseline },
  justify: { 'flex-start': Justify.FlexStart, center: Justify.Center, 'flex-end': Justify.FlexEnd, 'space-between': Justify.SpaceBetween, 'space-around': Justify.SpaceAround, 'space-evenly': Justify.SpaceEvenly },
  wrap: { wrap: Wrap.Wrap, nowrap: Wrap.NoWrap },
};
const edges = { Left: Edge.Left, Right: Edge.Right, Top: Edge.Top, Bottom: Edge.Bottom, Horizontal: Edge.Horizontal, Vertical: Edge.Vertical, '': Edge.All };

function apply(node, style) {
  const set = (key, fn) => style[key] !== undefined && fn(style[key]);
  set('display', (v) => node.setDisplay(v === 'none' ? Display.None : Display.Flex));
  set('position', (v) => node.setPositionType(v === 'absolute' ? PositionType.Absolute : PositionType.Relative));
  set('flexDirection', (v) => node.setFlexDirection(enums.flexDirection[v]));
  set('alignItems', (v) => node.setAlignItems(enums.align[v]));
  set('alignSelf', (v) => node.setAlignSelf(enums.align[v]));
  set('justifyContent', (v) => node.setJustifyContent(enums.justify[v]));
  set('flexWrap', (v) => node.setFlexWrap(enums.wrap[v]));
  set('flex', (v) => node.setFlex(v));
  set('flexGrow', (v) => node.setFlexGrow(v));
  set('flexShrink', (v) => node.setFlexShrink(v));
  set('flexBasis', (v) => node.setFlexBasis(v));
  set('aspectRatio', (v) => node.setAspectRatio(v));
  for (const key of ['width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight']) set(key, (v) => node['set' + key[0].toUpperCase() + key.slice(1)](v));
  for (const [suffix, edge] of Object.entries(edges)) {
    set('padding' + suffix, (v) => node.setPadding(edge, v));
    set('margin' + suffix, (v) => node.setMargin(edge, v));
    if (suffix !== 'Horizontal' && suffix !== 'Vertical') set('border' + suffix + 'Width', (v) => node.setBorder(edge, v));
  }
  for (const key of ['left', 'right', 'top', 'bottom']) set(key, (v) => node.setPosition(edges[key[0].toUpperCase() + key.slice(1)], v));
  set('gap', (v) => node.setGap(Gutter.All, v));
  set('rowGap', (v) => node.setGap(Gutter.Row, v));
  set('columnGap', (v) => node.setGap(Gutter.Column, v));
}

function build(Yoga, spec, out) {
  const node = Yoga.Node.create();
  apply(node, spec.style || {});
  if (spec.text !== undefined) {
    const length = spec.text.length * charWidth;
    node.setMeasureFunc((width, widthMode) => {
      if (widthMode === MeasureMode.Undefined || length <= width) return { width: widthMode === MeasureMode.Exactly ? width : length, height: lineHeight };
      return { width, height: Math.ceil(length / width) * lineHeight };
    });
  } else {
    spec.children.forEach((child, index) => node.insertChild(build(Yoga, child, out), index));
  }
  if (spec.testID) out.push([spec.testID, node]);
  return node;
}

const input = JSON.parse(await new Promise((resolve) => {
  let data = '';
  process.stdin.on('data', (chunk) => (data += chunk));
  process.stdin.on('end', () => resolve(data));
}));
const Yoga = await loadYoga();
const tagged = [];
const root = build(Yoga, input.tree, tagged);
root.calculateLayout(input.width, undefined, Direction.LTR);
const boxes = {};
for (const [id, node] of tagged) {
  let left = 0;
  for (let at = node; at; at = at.getParent()) left += at.getComputedLeft();
  boxes[id] = { left, width: node.getComputedWidth() };
}
process.stdout.write(JSON.stringify(boxes));
