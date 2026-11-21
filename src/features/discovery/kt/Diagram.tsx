import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';
import { radius, space, useTheme, type Colors } from '../../../theme';
import { Text } from '../../../ui/Text';
import { architectureLayout, flowLayout, ganttLayout, orgLayout, relationLayout, timelineLayout, type Picture, type Shape } from './diagramShape';
import { dayOf, useNumbers, type Numbers } from './format';
import type { DiagramBlock, Tone } from './read';
import { BlockTitle, Tool, toneColors, useWidth, styles as shared } from './ui';

const SMALLEST = 0.6;
const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3];
const DAY = 86400000;

type Paint = { fill?: string; stroke?: string; strokeWidth?: number; strokeDasharray?: string; fontSize?: number; fontWeight?: '600' | '400' };

function toneIn(cls: string[]): Tone | null {
  const found = cls.find((one) => one.startsWith('tone_'));
  return found ? (found.slice(5) as Tone) : null;
}

export function paintOf(shape: Shape, colors: Colors): Paint {
  const cls = shape.cls.split(' ');
  const has = (name: string) => cls.includes(name);
  const tone = toneIn(cls);
  const tint = tone ? toneColors(tone, colors) : null;
  if (shape.el === 'text') {
    const back = has('back');
    const fill = has('term_text') ? colors.onPrimary : has('today_label') || (has('edge_label') && back) ? colors.warnInk : has('sub') || has('tag') || has('edge_label') ? colors.inkSoft : colors.ink;
    const small = has('small') || has('sub') || has('tag') || has('edge_label') || has('today_label');
    const strong = has('strong') || has('lane_label') || has('column_label') || has('term_text') || has('tag') || has('today_label');
    return { fill, fontSize: small ? 11 : 12, fontWeight: strong ? '600' : '400' };
  }
  if (has('lane')) return { fill: has('lane_alt') ? colors.canvas : colors.surface };
  if (has('lane_head')) return { fill: colors.surface2 };
  if (has('column')) return { fill: colors.surface2, stroke: colors.line, strokeWidth: 1 };
  if (has('head')) return { fill: has('back') ? colors.warnInk : colors.edge };
  if (has('edge')) return { fill: 'none', stroke: has('back') ? colors.warnInk : colors.edge, strokeWidth: has('dependency') ? 1 : 1.3, strokeDasharray: has('back') ? '4 3' : undefined };
  if (has('axis')) return { stroke: colors.line, strokeWidth: 2, fill: 'none' };
  if (has('grid')) return { stroke: colors.line, strokeWidth: 1, fill: 'none' };
  if (has('today')) return { stroke: colors.warnInk, strokeWidth: 1.4, strokeDasharray: '3 3', fill: 'none' };
  if (has('milestone')) return has('planned') ? { fill: colors.surface, stroke: colors.primary, strokeWidth: 2 } : { fill: tint?.solid ?? colors.primary, stroke: tint?.solid ?? colors.primary, strokeWidth: 2 };
  if (has('bar') || has('term')) return { fill: tint?.solid ?? colors.primary };
  if (has('decision')) return { fill: tint?.band ?? colors.warnBand, stroke: tint?.solid ?? colors.warnInk, strokeWidth: 1.2 };
  if (has('node') || has('system')) {
    if (tint) return { fill: tint.band, stroke: tint.solid, strokeWidth: 1 };
    return { fill: colors.surface, stroke: has('top') ? colors.primary : colors.lineStrong, strokeWidth: has('top') ? 1.6 : 1 };
  }
  return { fill: colors.ink };
}

function DrawnShape({ shape, colors }: { shape: Shape; colors: Colors }) {
  const paint = paintOf(shape, colors);
  switch (shape.el) {
    case 'rect':
      return <Rect x={shape.x} y={shape.y} width={shape.w} height={shape.h} rx={shape.r} fill={paint.fill} stroke={paint.stroke} strokeWidth={paint.strokeWidth} />;
    case 'path':
      return <Path d={shape.d} fill={paint.fill} stroke={paint.stroke} strokeWidth={paint.strokeWidth} strokeDasharray={paint.strokeDasharray} strokeLinejoin="round" />;
    case 'circle':
      return <Circle cx={shape.cx} cy={shape.cy} r={shape.r} fill={paint.fill} stroke={paint.stroke} strokeWidth={paint.strokeWidth} />;
    default:
      return (
        <SvgText x={shape.x} y={shape.y} textAnchor={shape.anchor} fill={paint.fill} fontSize={paint.fontSize} fontWeight={paint.fontWeight}>
          {shape.text}
        </SvgText>
      );
  }
}

const DrawnPicture = memo(function DrawnPicture({ picture, width, colors }: { picture: Picture; width: number; colors: Colors }) {
  const height = (picture.height * width) / picture.width;
  return (
    <Svg width={width} height={height} viewBox={'0 0 ' + picture.width + ' ' + picture.height} accessible={false}>
      {picture.shapes.map((shape) => (
        <DrawnShape key={shape.key} shape={shape} colors={colors} />
      ))}
    </Svg>
  );
});

export function pictureOf(block: DiagramBlock, numbers: Numbers, todayWord: string): Picture {
  const formatter = (days: number[]) => {
    const years = new Set(days.map((day) => new Date(day * DAY).getUTCFullYear()));
    return (day: number) => numbers.day(day, years.size > 1);
  };
  switch (block.kind) {
    case 'flow':
      return flowLayout(block);
    case 'org':
      return orgLayout(block);
    case 'timeline':
      return timelineLayout(block, formatter(block.nodes.map((node) => dayOf(node.date))));
    case 'gantt':
      return ganttLayout(block, formatter(block.nodes.flatMap((node) => [dayOf(node.start), dayOf(node.end)])), numbers.month, todayWord);
    case 'relation':
      return relationLayout(block);
    default:
      return architectureLayout(block);
  }
}

function Steps({ picture, numbered }: { picture: Picture; numbered: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.steps}>
      {picture.steps.map((step) => {
        const tint = step.tone ? toneColors(step.tone, colors) : null;
        return (
          <View key={step.key} style={[styles.step, { paddingLeft: (step.depth ?? 0) * space.lg }]}>
            {numbered && step.number ? (
              <View style={[styles.number, { backgroundColor: colors.surface2 }]}>
                <Text variant="label" tone="inkSoft">
                  {String(step.number)}
                </Text>
              </View>
            ) : null}
            <View style={styles.stepBody}>
              <View style={styles.stepLine}>
                {step.chip ? (
                  <View style={[styles.chip, { backgroundColor: tint?.band ?? colors.surface2 }]}>
                    <Text variant="label" style={{ color: tint?.ink ?? colors.inkSoft }}>
                      {step.chip}
                    </Text>
                  </View>
                ) : null}
                <Text variant="footnote" style={styles.stepText}>
                  {step.target ? step.text + (step.relation ? ' \u2014 ' + step.relation + ' \u2192 ' : ' \u2192 ') + step.target : step.text}
                </Text>
                {!step.chip && tint ? <View style={[shared.dot, { backgroundColor: tint.solid }]} /> : null}
              </View>
              {step.note ? (
                <Text variant="label" tone="inkSoft">
                  {step.note}
                </Text>
              ) : null}
              {step.outs?.map((out) => (
                <Text key={out.key} variant="label" style={{ color: out.back ? colors.warnInk : colors.inkSoft }}>
                  {(out.back ? '\u21a9 ' : '\u2192 ') + (out.label ? out.label + ': ' : '') + out.target}
                </Text>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Screen({ title, summary, picture, onClose }: { title: string; summary: string; picture: Picture; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [room, onLayout] = useWidth();
  const [zoom, setZoom] = useState(1);
  const step = (by: number) => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, (ZOOMS.indexOf(zoom) === -1 ? 2 : ZOOMS.indexOf(zoom)) + by))]);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
        <View style={styles.screenHead}>
          <Text variant="headline" style={shared.grow} numberOfLines={2}>
            {title}
          </Text>
          <Tool icon="close" label={t('discovery.block.close')} hideLabel onPress={onClose} testID="kt-diagram-close" />
        </View>
        <View style={[shared.tools, styles.pad]}>
          <Tool icon="zoomOut" label={t('discovery.block.diagram.zoomOut')} onPress={() => step(-1)} />
          <Tool icon="expand" label={t('discovery.block.diagram.fit')} onPress={() => setZoom(Math.min(3, Math.max(0.25, (room - 16) / picture.width)))} />
          <Tool icon="zoomIn" label={t('discovery.block.diagram.zoomIn')} onPress={() => step(1)} />
        </View>
        <ScrollView style={shared.grow} onLayout={onLayout} contentContainerStyle={styles.pad}>
          <ScrollView horizontal nestedScrollEnabled>
            <DrawnPicture picture={picture} width={Math.round(picture.width * zoom)} colors={colors} />
          </ScrollView>
          {summary ? (
            <Text variant="footnote" tone="inkSoft" style={styles.summary}>
              {summary}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export const KtDiagram = memo(function KtDiagram({ block, summary }: { block: DiagramBlock; summary: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const numbers = useNumbers();
  const [width, onLayout] = useWidth();
  const [full, setFull] = useState(false);
  const [listed, setListed] = useState(false);
  const picture = useMemo(() => pictureOf(block, numbers, t('discovery.block.diagram.today')), [block, numbers, t]);
  const count = block.nodes.length;
  const decisions = block.nodes.filter((node) => node.shape === 'decision').length;
  const counted =
    block.kind === 'flow'
      ? t('discovery.block.diagram.steps', { count }) + (decisions ? ' \u00b7 ' + t('discovery.block.diagram.decisions', { count: decisions }) : '')
      : block.kind === 'org'
        ? t('discovery.block.diagram.people', { count })
        : block.kind === 'timeline'
          ? t('discovery.block.diagram.milestones', { count })
          : block.kind === 'gantt'
            ? t('discovery.block.diagram.tasks', { count })
            : t('discovery.block.diagram.items', { count });
  const meta = t(`discovery.block.diagram.kind.${block.kind}`) + ' \u00b7 ' + counted;
  const drawnWidth = width ? Math.round(Math.min(picture.width, Math.max(picture.width * SMALLEST, width))) : 0;
  return (
    <View style={shared.gap} testID="kt-diagram">
      <BlockTitle title={block.title} count={meta} />
      <View style={shared.tools}>
        <Tool icon="expand" label={t('discovery.block.diagram.fullScreen')} onPress={() => setFull(true)} testID="kt-diagram-full" />
        <Tool icon="steps" label={t('discovery.block.diagram.asList')} on={listed} onPress={() => setListed(!listed)} testID="kt-diagram-list" />
      </View>
      <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={(block.title || meta) + '. ' + summary}>
        {drawnWidth ? (
          <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
            <Pressable onPress={() => setFull(true)} accessibilityLabel={t('discovery.block.diagram.fullScreen')}>
              <DrawnPicture picture={picture} width={drawnWidth} colors={colors} />
            </Pressable>
          </ScrollView>
        ) : null}
      </View>
      {listed ? <Steps picture={picture} numbered={block.kind === 'flow'} /> : null}
      {full ? <Screen title={block.title || meta} summary={summary} picture={picture} onClose={() => setFull(false)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  steps: { gap: space.sm },
  step: { flexDirection: 'row', gap: space.sm },
  number: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepBody: { flex: 1, gap: 2 },
  stepLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  stepText: { flexShrink: 1 },
  chip: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 1 },
  screen: { flex: 1 },
  screenHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  pad: { paddingHorizontal: space.lg, paddingBottom: space.md },
  summary: { marginTop: space.md },
});
