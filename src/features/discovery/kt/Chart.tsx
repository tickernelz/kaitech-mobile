import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { space, useTheme, type Colors, type Scheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { drawnOf, figureOf, chartColumns, type Cartesian, type Donut, type Funnel, type Gauges, type Heatmap, type Spark } from './chartShape';
import { useNumbers } from './format';
import type { Place } from './place';
import type { ChartBlock, TableBlock } from './read';
import { KtTable } from './Table';
import { BlockTitle, heatFill, seriesColor, Tool, useWidth, styles as shared } from './ui';

const FONT = 11;

function CartesianView({ figure, scheme, colors }: { figure: Cartesian; scheme: Scheme; colors: Colors }) {
  return (
    <Svg width={figure.width} height={figure.height} accessible={false}>
      {figure.grid.map((tick) => (
        <G key={tick.key}>
          <Line x1={figure.left} x2={figure.right} y1={tick.y} y2={tick.y} stroke={tick.zero ? colors.lineStrong : colors.line} strokeWidth={1} />
          <SvgText x={figure.left - 6} y={tick.y + 4} fontSize={FONT} fill={colors.inkSoft} textAnchor="end">
            {tick.text}
          </SvgText>
        </G>
      ))}
      {figure.labels.map((label) => (
        <SvgText key={label.key} x={label.x} y={figure.base + 16} fontSize={FONT} fill={colors.inkSoft} textAnchor="middle">
          {label.text}
        </SvgText>
      ))}
      {figure.areas.map((area) => (
        <Path key={area.key} d={area.d} fill={seriesColor(area.series, scheme)} fillOpacity={0.18} />
      ))}
      {figure.bars.map((bar) => (
        <Rect key={bar.key} x={bar.x} y={bar.y} width={bar.width} height={bar.height} rx={1.5} fill={seriesColor(bar.series, scheme)} />
      ))}
      {figure.paths.map((path) =>
        path.line ? (
          <Path key={path.key} d={path.d} stroke={seriesColor(path.series, scheme)} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        ) : (
          <Path key={path.key} d={path.d} fill={seriesColor(path.series, scheme)} />
        ),
      )}
      {figure.dots.map((dot) => (
        <Circle key={dot.key} cx={dot.x} cy={dot.y} r={3} fill={colors.surface} stroke={seriesColor(dot.series, scheme)} strokeWidth={2} />
      ))}
    </Svg>
  );
}

function DonutView({ figure, scheme, colors, wide }: { figure: Donut; scheme: Scheme; colors: Colors; wide: boolean }) {
  const center = figure.size / 2;
  return (
    <View style={[styles.donut, wide ? styles.side : null]}>
      <View>
        <Svg width={figure.size} height={figure.size} accessible={false}>
          {figure.slices.map((slice) => (
            <Path key={slice.key} d={slice.d} fill={seriesColor(slice.series, scheme)} fillRule="evenodd" />
          ))}
          <SvgText x={center} y={center + 6} fontSize={16} fontWeight="700" fill={colors.ink} textAnchor="middle">
            {figure.total}
          </SvgText>
        </Svg>
      </View>
      <View style={styles.legend}>
        {figure.legend.map((item) => (
          <View key={item.key} style={styles.legendRow}>
            <View style={[shared.dot, { backgroundColor: seriesColor(item.series, scheme) }]} />
            <Text variant="footnote" style={shared.grow}>
              {item.label}
            </Text>
            <Text variant="footnote" tone="inkSoft">
              {item.value + ' \u00b7 ' + item.share}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function GaugesView({ figure, scheme, colors }: { figure: Gauges; scheme: Scheme; colors: Colors }) {
  return (
    <View style={styles.gauges}>
      {figure.gauges.map((gauge) => (
        <View key={gauge.key} style={styles.gauge}>
          <Svg width={180} height={96} accessible={false}>
            <Path d={gauge.track} stroke={colors.surface2} strokeWidth={14} fill="none" strokeLinecap="round" />
            {gauge.arc ? <Path d={gauge.arc} stroke={seriesColor(gauge.series, scheme)} strokeWidth={14} fill="none" strokeLinecap="round" /> : null}
            <SvgText x={90} y={80} fontSize={18} fontWeight="700" fill={colors.ink} textAnchor="middle">
              {gauge.value}
            </SvgText>
          </Svg>
          <Text variant="footnote" style={styles.center}>
            {gauge.label}
          </Text>
          <Text variant="label" tone="inkSoft" style={styles.center}>
            {gauge.max}
          </Text>
        </View>
      ))}
    </View>
  );
}

function FunnelView({ figure, scheme, colors }: { figure: Funnel; scheme: Scheme; colors: Colors }) {
  return (
    <Svg width={figure.width} height={figure.height} accessible={false}>
      {figure.rows.map((row) => (
        <G key={row.key}>
          <SvgText x={0} y={row.top + 14} fontSize={12} fontWeight="600" fill={colors.ink}>
            {row.label}
          </SvgText>
          <SvgText x={0} y={row.top + 30} fontSize={FONT} fill={colors.inkSoft}>
            {row.detail}
          </SvgText>
          <Rect x={row.x} y={row.top} width={row.width} height={36} rx={4} fill={seriesColor(0, scheme)} fillOpacity={Math.max(0.35, 1 - row.key * 0.08)} />
        </G>
      ))}
    </Svg>
  );
}

function HeatmapView({ figure, colors }: { figure: Heatmap; colors: Colors }) {
  return (
    <View style={shared.gap}>
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <Svg width={figure.width} height={figure.height} accessible={false}>
          {figure.columnLabels.map((label) => (
            <SvgText key={label.key} x={label.x} y={14} fontSize={FONT} fill={colors.inkSoft} textAnchor="middle">
              {label.text}
            </SvgText>
          ))}
          {figure.rowLabels.map((label) => (
            <SvgText key={label.key} x={0} y={label.y} fontSize={FONT} fill={colors.ink}>
              {label.text}
            </SvgText>
          ))}
          {figure.cells.map((cell) => {
            const paint = heatFill(cell.level, cell.known, colors);
            return (
              <G key={cell.key}>
                <Rect x={cell.x} y={cell.y} width={figure.cell} height={figure.cell} rx={3} fill={paint.fill} fillOpacity={paint.opacity} />
                {cell.text ? (
                  <SvgText x={cell.x + figure.cell / 2} y={cell.y + figure.cell / 2 + 4} fontSize={10} fill={paint.ink} textAnchor="middle">
                    {cell.text}
                  </SvgText>
                ) : null}
              </G>
            );
          })}
        </Svg>
      </ScrollView>
      {figure.low !== '' ? (
        <View style={styles.scale}>
          <Text variant="label" tone="inkSoft">
            {figure.low}
          </Text>
          {[0, 1, 2, 3, 4, 5].map((level) => {
            const paint = heatFill(level, true, colors);
            return <View key={level} style={[styles.swatch, { backgroundColor: paint.fill, opacity: paint.opacity }]} />;
          })}
          <Text variant="label" tone="inkSoft">
            {figure.high}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function SparkView({ figure, scheme }: { figure: Spark; scheme: Scheme }) {
  return (
    <View style={styles.sparkLine}>
      <Svg width={figure.width} height={figure.height} accessible={false}>
        <Path d={figure.d} stroke={seriesColor(0, scheme)} strokeWidth={2} fill="none" strokeLinejoin="round" />
        {figure.end ? <Circle cx={figure.end.x} cy={figure.end.y} r={3.5} fill={seriesColor(0, scheme)} /> : null}
      </Svg>
      <Text variant="footnote" tone="inkSoft">
        {figure.said}
      </Text>
    </View>
  );
}

export const KtChart = memo(function KtChart({ block, place }: { block: ChartBlock; place: Place | null }) {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  const numbers = useNumbers();
  const [width, onLayout] = useWidth();
  const [asTable, setAsTable] = useState(false);
  const drawn = useMemo(() => drawnOf(block), [block]);
  const words = useMemo(
    () => ({
      stepBefore: (value: string, share: string) => t('discovery.block.chart.stepBefore', { value, share }),
      of: (max: string) => t('discovery.block.chart.of', { max }),
    }),
    [t],
  );
  const figure = useMemo(() => (width > 0 ? figureOf(block, drawn, width, numbers, words) : null), [block, drawn, width, numbers, words]);
  const table = useMemo<TableBlock>(() => {
    const { columns, rows } = chartColumns(block, {
      name: t('discovery.block.chart.name'),
      value: t('discovery.block.chart.value'),
      max: t('discovery.block.chart.max'),
      label: t('discovery.block.chart.label'),
    });
    return { title: '', columns, rows, rowCount: null };
  }, [block, t]);
  const legend = ['donut', 'heatmap', 'gauge', 'funnel', 'spark'].includes(block.chart) || drawn.series.length < 2 ? [] : drawn.series;
  return (
    <View style={shared.gap} testID="kt-chart">
      <BlockTitle title={block.title} />
      <View style={shared.tools}>
        <Tool icon={asTable ? 'minutes' : 'table'} label={asTable ? t('discovery.block.chart.asChart') : t('discovery.block.chart.asTable')} on={asTable} onPress={() => setAsTable(!asTable)} testID="kt-chart-table" />
      </View>
      {asTable ? (
        <KtTable block={table} place={place} ordered={false} />
      ) : (
        <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={block.title || t('discovery.block.chart.chart')}>
          {figure?.kind === 'cartesian' ? <CartesianView figure={figure} scheme={scheme} colors={colors} /> : null}
          {figure?.kind === 'donut' ? <DonutView figure={figure} scheme={scheme} colors={colors} wide={width >= 420} /> : null}
          {figure?.kind === 'gauge' ? <GaugesView figure={figure} scheme={scheme} colors={colors} /> : null}
          {figure?.kind === 'funnel' ? <FunnelView figure={figure} scheme={scheme} colors={colors} /> : null}
          {figure?.kind === 'heatmap' ? <HeatmapView figure={figure} colors={colors} /> : null}
          {figure?.kind === 'spark' ? <SparkView figure={figure} scheme={scheme} /> : null}
        </View>
      )}
      {!asTable && legend.length ? (
        <View style={styles.legendWrap}>
          {legend.map((line, index) => (
            <View key={index} style={styles.legendRow}>
              <View style={[shared.dot, { backgroundColor: seriesColor(index, scheme) }]} />
              <Text variant="footnote">{line.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {!asTable && drawn.size > 1 ? (
        <Text variant="footnote" tone="inkSoft">
          {t('discovery.block.chart.averaged', { size: drawn.size })}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  donut: { gap: space.md, alignItems: 'center' },
  side: { flexDirection: 'row', alignItems: 'center' },
  legend: { gap: space.xs, alignSelf: 'stretch', flexGrow: 1 },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  gauges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, justifyContent: 'center' },
  gauge: { alignItems: 'center', width: 180 },
  center: { textAlign: 'center' },
  scale: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  swatch: { width: 16, height: 10, borderRadius: 2 },
  sparkLine: { gap: space.xs },
});
