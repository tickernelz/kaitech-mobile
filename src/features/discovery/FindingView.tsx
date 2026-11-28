import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { useResource } from '../../api/resource';
import { useFormatters } from '../../i18n';
import { readableWidth } from '../../layout/windowClass';
import { space, stroke, useTheme } from '../../theme';
import { Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { finding as readFinding, type Finding } from './api';
import { parseServerDate } from './dates';
import { sourceIcon, sourceLabelKey } from './sources';
import { Icon } from '../../ui/icons';
import { Chip, StateView } from './ui';

export function findingTone(row: Finding): 'warn' | 'ok' | 'info' {
  if (row.kind === 'conflict') return 'warn';
  if (row.kind === 'corroboration') return 'ok';
  return 'info';
}

export function FindingView({ id, programme }: { id: number; programme?: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { date } = useFormatters();
  const shown = useResource(`discovery.finding.${id}`, (account) => readFinding(account, id));
  if (!shown.data) return <StateView loading={!shown.error} error={shown.error} onRetry={() => void shown.refresh()} testID="finding" />;
  const { finding, sides } = shown.data;
  const engagement = programme;
  return (
    <ScrollView contentContainerStyle={styles.content} testID="finding-detail">
      <View style={styles.chips}>
        <Chip tone={findingTone(finding)} label={t(`discovery.finding.kind.${finding.kind}` as never, { defaultValue: finding.kind }) as string} />
        <Chip tone={finding.state === 'accepted' ? 'ok' : 'neutral'} label={t(`discovery.finding.state.${finding.state}` as never, { defaultValue: finding.state }) as string} />
        {finding.ck_id ? <Chip label={finding.ck_id} /> : null}
      </View>
      <Text variant="title" accessibilityRole="header">
        {finding.name}
      </Text>
      <Text tone="inkSoft" selectable>
        {finding.body}
      </Text>
      <Section title={t('discovery.finding.evidence', { count: sides.length })}>
        {sides.map((side) => {
          const at = parseServerDate(side.stated_at);
          return (
            <View key={side.id} style={[styles.side, { borderColor: colors.line }]} testID={`finding-side-${side.id}`}>
              <View style={[styles.sideIcon, { backgroundColor: colors.surface2 }]}>
                <Icon name={sourceIcon(side.source_kind)} size={20} color={colors.selectInk} />
              </View>
              <View style={styles.fill}>
                <Text variant="callout" selectable>
                  {'\u201C'}
                  {side.quote}
                  {'\u201D'}
                </Text>
                <Text variant="footnote" tone="inkSoft">
                  {[t(sourceLabelKey(side.source_kind) as never) as string, side.source_text_id ? side.source_text_id[1] : '', side.stated_by || '', at ? date(at) : '']
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {!side.live ? <Chip tone="neutral" label={t('discovery.evidence.withdrawn')} /> : null}
              </View>
            </View>
          );
        })}
      </Section>
      {finding.question_id ? (
        <Section title={t('discovery.finding.usedIn')}>
          <View style={styles.side}>
            <Text>{finding.question_id[1]}</Text>
          </View>
        </Section>
      ) : null}
      {engagement ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/program/[id]/coworker',
              params: { id: String(engagement), prefill: t('discovery.finding.askPrefill', { name: finding.name }) },
            })
          }
          testID="finding-ask"
          style={({ pressed }) => [styles.ask, { backgroundColor: pressed ? colors.select : colors.surface2 }]}>
          <Icon name="sparkle" color={colors.selectInk} />
          <Text tone="selectInk" style={styles.fill}>
            {t('discovery.finding.ask')}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { padding: space.lg, gap: space.md, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  side: { flexDirection: 'row', gap: space.md, padding: space.md, borderBottomWidth: stroke.hairline },
  sideIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ask: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg, borderRadius: 999 },
});
