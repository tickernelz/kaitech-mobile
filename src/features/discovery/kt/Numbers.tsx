import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { radius, space, stroke, useTheme, type Colors } from '../../../theme';
import { Icon, type IconName } from '../../../ui/icons';
import { Text } from '../../../ui/Text';
import { decimalsOf, signed, useNumbers, withUnit } from './format';
import type { Better, CompareBlock, KpiBlock, Tone } from './read';
import { BlockTitle, toneColors, styles as shared } from './ui';

export function toneOfChange(change: number, better: Better): Tone {
  if (!change || !better) return 'neutral';
  return change > 0 === (better === 'up') ? 'good' : 'bad';
}

function arrowOf(change: number): IconName {
  if (!change) return 'minus';
  return change > 0 ? 'arrowUp' : 'arrowDown';
}

function Change({ text, tone, arrow, colors }: { text: string; tone: Tone; arrow: IconName; colors: Colors }) {
  const ink = toneColors(tone, colors).ink;
  return (
    <View style={styles.change}>
      <Icon name={arrow} size={14} color={ink} />
      <Text variant="footnote" style={[styles.bold, { color: ink }]}>
        {text}
      </Text>
    </View>
  );
}

export const KtKpi = memo(function KtKpi({ block }: { block: KpiBlock }) {
  const { colors } = useTheme();
  const numbers = useNumbers();
  return (
    <View style={shared.gap} testID="kt-kpi">
      <BlockTitle title={block.title} />
      <View style={[styles.kpis, { borderColor: colors.line }]}>
        {block.items.map((item, index) => {
          const places = item.decimals ?? decimalsOf([item.value, item.delta]);
          const value = typeof item.value === 'number' ? numbers.number(item.value, places, false) : item.value;
          const delta = item.delta;
          return (
            <View key={index} style={[styles.kpi, index ? { borderTopColor: colors.line, borderTopWidth: stroke.hairline } : null]}>
              <View style={shared.grow}>
                <Text variant="footnote" tone="inkSoft">
                  {item.label}
                </Text>
                {item.basis ? (
                  <Text variant="label" tone="inkFaint">
                    {item.basis}
                  </Text>
                ) : null}
              </View>
              <View style={styles.figure}>
                <Text variant="headline" style={styles.value} selectable>
                  {value}
                  {item.unit ? (
                    <Text variant="footnote" tone="inkSoft">
                      {' ' + item.unit}
                    </Text>
                  ) : null}
                </Text>
                {delta !== null ? (
                  <Change text={withUnit(signed(numbers, delta, places), item.deltaUnit || item.unit)} tone={toneOfChange(delta, item.better)} arrow={arrowOf(delta)} colors={colors} />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
});

export const KtCompare = memo(function KtCompare({ block }: { block: CompareBlock }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const numbers = useNumbers();
  const before = block.beforeLabel || t('discovery.block.compare.before');
  const after = block.afterLabel || t('discovery.block.compare.after');
  const rows = block.items.map((item, index) => {
    const places = item.decimals ?? decimalsOf([item.before, item.after]);
    const change = item.after - item.before;
    const most = Math.max(Math.abs(item.before), Math.abs(item.after)) || 1;
    const share = item.before ? ' (' + signed(numbers, (change / Math.abs(item.before)) * 100, 0) + '%)' : '';
    return {
      key: index,
      label: item.label,
      before: withUnit(numbers.number(item.before, places, false), item.unit),
      after: withUnit(numbers.number(item.after, places, false), item.unit),
      change: withUnit(signed(numbers, change, places), item.unit) + share,
      tone: toneOfChange(change, item.better),
      arrow: arrowOf(change),
      beforeShare: Math.round((Math.abs(item.before) / most) * 100),
      afterShare: Math.round((Math.abs(item.after) / most) * 100),
    };
  });
  if (rows.length === 1) {
    const row = rows[0];
    const tint = toneColors(row.tone, colors);
    return (
      <View style={shared.gap} testID="kt-compare">
        <BlockTitle title={block.title} />
        <View style={styles.pair}>
          <View style={[styles.side, { borderColor: colors.line }]}>
            <Text variant="footnote" tone="inkSoft">
              {before}
            </Text>
            <Text variant="headline" selectable>
              {row.before}
            </Text>
            <Text variant="label" tone="inkFaint">
              {row.label}
            </Text>
          </View>
          <Icon name="forward" size={18} color={colors.inkFaint} />
          <View style={[styles.side, { borderColor: tint.solid, backgroundColor: tint.band }]}>
            <Text variant="footnote" tone="inkSoft">
              {after}
            </Text>
            <Text variant="headline" selectable>
              {row.after}
            </Text>
            <Change text={row.change} tone={row.tone} arrow={row.arrow} colors={colors} />
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={shared.gap} testID="kt-compare">
      <BlockTitle title={block.title} />
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={[styles.grid, { borderColor: colors.line }]}>
          <View style={[styles.row, { backgroundColor: colors.surface2 }]}>
            <Text variant="label" tone="inkSoft" style={styles.labelCell}>
              {t('discovery.block.compare.item')}
            </Text>
            <Text variant="label" tone="inkSoft" style={styles.numberCell}>
              {before}
            </Text>
            <Text variant="label" tone="inkSoft" style={styles.numberCell}>
              {after}
            </Text>
            <Text variant="label" tone="inkSoft" style={styles.changeCell}>
              {t('discovery.block.compare.change')}
            </Text>
          </View>
          {rows.map((row) => (
            <View key={row.key} style={[styles.row, { borderTopColor: colors.line, borderTopWidth: stroke.hairline }]}>
              <View style={styles.labelCell}>
                <Text variant="footnote">{row.label}</Text>
                <View style={styles.bars}>
                  <View style={[styles.bar, { width: row.beforeShare + '%', backgroundColor: colors.lineStrong }]} />
                  <View style={[styles.bar, { width: row.afterShare + '%', backgroundColor: colors.primary }]} />
                </View>
              </View>
              <Text variant="footnote" style={styles.numberCell} selectable>
                {row.before}
              </Text>
              <Text variant="footnote" style={styles.numberCell} selectable>
                {row.after}
              </Text>
              <View style={[styles.changeCell, styles.changeEnd]}>
                <Change text={row.change} tone={row.tone} arrow={row.arrow} colors={colors} />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  kpis: { borderWidth: stroke.thin, borderRadius: radius.md },
  kpi: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  figure: { alignItems: 'flex-end', gap: 2 },
  value: { fontVariant: ['tabular-nums'] },
  change: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  bold: { fontWeight: '700' },
  pair: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  side: { flex: 1, gap: 2, borderWidth: stroke.thin, borderRadius: radius.md, padding: space.md },
  grid: { borderWidth: stroke.thin, borderRadius: radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  labelCell: { width: 168, paddingHorizontal: space.sm, paddingVertical: space.sm, gap: space.xs },
  numberCell: { width: 104, paddingHorizontal: space.sm, paddingVertical: space.sm, textAlign: 'right', fontVariant: ['tabular-nums'] },
  changeCell: { width: 144, paddingHorizontal: space.sm, paddingVertical: space.sm, textAlign: 'right' },
  changeEnd: { alignItems: 'flex-end' },
  bars: { gap: 2 },
  bar: { height: 4, borderRadius: 2 },
});
