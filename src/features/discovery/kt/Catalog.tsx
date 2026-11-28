import * as Clipboard from 'expo-clipboard';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { radius, space, stroke, useTheme } from '../../../theme';
import { Icon, type IconName } from '../../../ui/icons';
import { Text } from '../../../ui/Text';
import { useNumbers } from './format';
import type { AccordionBlock, CalloutBlock, ChecklistBlock, CodeBlock, OptionsBlock, ProgressBlock, Tone } from './read';
import { BlockTitle, Meter, Status, Tool, toneColors, styles as shared } from './ui';

export const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

const CALLOUT_ICON: Record<Tone, IconName> = { good: 'check', warn: 'clock', bad: 'alert', info: 'bulb', neutral: 'steps' };

export const KtCallout = memo(function KtCallout({ block }: { block: CalloutBlock }) {
  const { colors } = useTheme();
  return (
    <View style={shared.gap} testID="kt-callout">
      <BlockTitle title={block.title} />
      {block.items.map((item, index) => {
        const tint = toneColors(item.tone, colors);
        return (
          <View key={index} style={[styles.callout, { backgroundColor: tint.band }]}>
            <Icon name={CALLOUT_ICON[item.tone]} size={18} color={tint.ink} variant={item.tone === 'bad' ? 'fill' : 'line'} />
            <View style={shared.grow}>
              <Text variant="callout" style={[styles.bold, { color: tint.ink }]}>
                {item.heading}
              </Text>
              <Text variant="footnote" selectable>
                {item.text}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
});

export const KtChecklist = memo(function KtChecklist({ block }: { block: ChecklistBlock }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const done = block.items.filter((item) => item.done).length;
  const total = block.items.length;
  const countLabel = t('discovery.block.checklist.count', { done, total });
  return (
    <View style={shared.gap} testID="kt-checklist">
      <BlockTitle title={block.title} count={countLabel} />
      <Meter share={(100 * done) / total} tone="good" label={countLabel} max={total} now={done} />
      {block.items.map((item, index) => (
        <View key={index} style={styles.check} accessible accessibilityRole="checkbox" accessibilityState={{ checked: item.done, disabled: true }} accessibilityLabel={item.label + (item.note ? ', ' + item.note : '')}>
          <View style={[styles.box, item.done ? { backgroundColor: colors.ok, borderColor: colors.ok } : { borderColor: colors.lineStrong }]}>
            {item.done ? <Icon name="check" size={14} color={colors.onPrimary} /> : null}
          </View>
          <View style={shared.grow}>
            <Text variant="footnote">
              {item.label}
            </Text>
            <Text variant="label" tone="inkSoft">
              {(item.done ? t('discovery.block.checklist.done') : t('discovery.block.checklist.open')) + (item.note ? ' \u00b7 ' + item.note : '')}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
});

export const KtProgress = memo(function KtProgress({ block }: { block: ProgressBlock }) {
  const { t } = useTranslation();
  const numbers = useNumbers();
  const text = (value: number) => (Number.isInteger(value) ? String(value) : numbers.number(value, 2, false));
  return (
    <View style={shared.gap} testID="kt-progress">
      <BlockTitle title={block.title} />
      {block.items.map((item, index) => {
        const amount = t('discovery.block.progress.amount', { value: text(item.value), total: text(item.total), unit: item.unit ? ' ' + item.unit : '' });
        return (
          <View key={index} style={styles.progress}>
            <View style={shared.titleLine}>
              <Text variant="footnote" style={shared.grow}>
                {item.label}
              </Text>
              <Text variant="label" tone="inkSoft">
                {amount}
              </Text>
            </View>
            <Meter share={Math.min(100, Math.round((100 * item.value) / item.total))} tone={item.tone ?? 'info'} label={item.label + ': ' + amount} max={item.total} now={item.value} />
          </View>
        );
      })}
    </View>
  );
});

export const KtAccordion = memo(function KtAccordion({ block }: { block: AccordionBlock }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(() => block.items.map((item) => item.open));
  return (
    <View style={shared.gap} testID="kt-accordion">
      <BlockTitle title={block.title} />
      <View style={[styles.accordion, { borderColor: colors.line }]}>
        {block.items.map((item, index) => (
          <View key={index} style={index ? { borderTopColor: colors.line, borderTopWidth: stroke.hairline } : null}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: open[index] }}
              onPress={() => setOpen(open.map((value, position) => (position === index ? !value : value)))}
              testID={`kt-accordion-${index}`}
              style={({ pressed }) => [styles.fold, pressed ? { backgroundColor: colors.surface2 } : null]}>
              <View style={open[index] ? styles.turned : null}>
                <Icon name="forward" size={16} color={colors.inkSoft} />
              </View>
              <Text variant="callout" style={[shared.grow, styles.bold]}>
                {item.title}
              </Text>
            </Pressable>
            {open[index] ? (
              <Text variant="footnote" style={styles.foldBody} selectable>
                {item.body}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
});

export const KtOptions = memo(function KtOptions({ block }: { block: OptionsBlock }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const numbers = useNumbers();
  const valueText = (value: string | number | null) => (value === null || value === '' ? '-' : typeof value === 'number' ? (Number.isInteger(value) ? String(value) : numbers.number(value, 2, false)) : value);
  return (
    <View style={shared.gap} testID="kt-options">
      <BlockTitle title={block.title} />
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
        <View style={[styles.grid, { borderColor: colors.line }]}>
          <View style={[styles.row, { backgroundColor: colors.surface2 }]}>
            <Text variant="label" tone="inkSoft" style={styles.criterion}>
              {t('discovery.block.options.criterion')}
            </Text>
            {block.options.map((option) => (
              <Text key={option} variant="callout" style={[styles.option, styles.bold]}>
                {option}
              </Text>
            ))}
          </View>
          {block.rows.map((row, index) => (
            <View key={index} style={[styles.row, { borderTopColor: colors.line, borderTopWidth: stroke.hairline }]}>
              <Text variant="footnote" tone="inkSoft" style={styles.criterion}>
                {row.label}
              </Text>
              {block.options.map((option, position) => (
                <View key={option} style={styles.option}>
                  {row.tones[position] ? <Status tone={row.tones[position]} text={valueText(row.values[position])} /> : <Text variant="footnote">{valueText(row.values[position])}</Text>}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      <Text variant="footnote" tone="inkSoft">
        {t('discovery.block.options.note')}
      </Text>
    </View>
  );
});

export const KtCode = memo(function KtCode({ block }: { block: CodeBlock }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const lines = block.code.split('\n').length;
  return (
    <View style={shared.gap} testID="kt-code">
      <BlockTitle title={block.title} count={t('discovery.block.code.lines', { count: lines })} />
      <View style={shared.tools}>
        <View style={[styles.language, { backgroundColor: colors.surface2 }]}>
          <Text variant="label" tone="inkSoft" style={{ fontFamily: MONO }}>
            {block.language}
          </Text>
        </View>
        <Tool
          icon={copied ? 'check' : 'copy'}
          label={copied ? t('discovery.block.copied') : t('discovery.block.copy')}
          on={copied}
          onPress={() => void Clipboard.setStringAsync(block.code).then(() => setCopied(true))}
          testID="kt-code-copy"
        />
      </View>
      <ScrollView nestedScrollEnabled style={[styles.code, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled>
          <Text style={[styles.mono, { color: colors.ink }]} selectable accessibilityLabel={block.language}>
            {block.code}
          </Text>
        </ScrollView>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  bold: { fontWeight: '700' },
  callout: { flexDirection: 'row', gap: space.sm, borderRadius: radius.md, padding: space.md },
  check: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  progress: { gap: space.xs },
  accordion: { borderWidth: stroke.thin, borderRadius: radius.md, overflow: 'hidden' },
  fold: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 44, paddingHorizontal: space.md, paddingVertical: space.sm },
  turned: { transform: [{ rotate: '90deg' }] },
  foldBody: { paddingHorizontal: space.md, paddingBottom: space.md, paddingLeft: space.md + 24 },
  grid: { borderWidth: stroke.thin, borderRadius: radius.sm, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  criterion: { width: 120, paddingHorizontal: space.sm, paddingVertical: space.sm },
  option: { width: 132, paddingHorizontal: space.sm, paddingVertical: space.sm },
  language: { borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 4, justifyContent: 'center' },
  code: { borderWidth: stroke.thin, borderRadius: radius.sm, maxHeight: 360 },
  mono: { fontFamily: MONO, fontSize: 13, lineHeight: 19, padding: space.md },
});
