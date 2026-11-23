import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { invalidate } from '../../api/resource';
import { useSession } from '../../auth/session';
import { space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/icons';
import { Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { Card, useErrorText } from '../discovery/ui';
import type { Detail, Item } from './api';
import { ChoiceRow } from './followupParts';
import { generateMinutes, isGenerating, itemFilters, itemTypes, whyNot, type ItemFilter, type MinutesPart } from './minutes';

export function MinutesBar({ detail }: { detail: Detail }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const errorText = useErrorText();
  const { active } = useSession();
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const generating = isGenerating(detail);
  const reasons = whyNot(detail);
  const transcribed = detail.recordings.length > 0 && detail.recordings.every((one) => one.transcribed);
  const validated = transcribed && detail.recordings.every((one) => !(one.unvalidated ?? []).length);
  const steps: { key: 'transcribed' | 'speakers' | 'generated'; done: boolean }[] = [
    { key: 'transcribed', done: transcribed },
    { key: 'speakers', done: validated },
    { key: 'generated', done: detail.generated && !generating },
  ];
  const generate = async () => {
    if (!active || busy) return;
    setBusy(true);
    setProblem('');
    try {
      await generateMinutes(active, detail.meeting_id);
      invalidate(`${active.id}:mom.`);
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card testID="minutes-bar">
      <View style={styles.steps}>
        {steps.map((step) => (
          <View key={step.key} style={styles.step} accessible accessibilityLabel={`${t(`mom.minutesBar.${step.key}`)}: ${t(step.done ? 'mom.minutesBar.done' : 'mom.minutesBar.notYet')}`}>
            <Icon name={step.done ? 'check' : 'clock'} size={16} color={step.done ? colors.okInk : colors.inkFaint} />
            <Text variant="footnote" tone={step.done ? 'ink' : 'inkSoft'}>
              {t(`mom.minutesBar.${step.key}`)}
            </Text>
          </View>
        ))}
      </View>
      {generating || detail.job?.message ? (
        <Text variant="footnote" tone="inkSoft" accessibilityRole="alert">
          {[detail.job?.label, detail.job?.message].filter(Boolean).join(' · ')}
        </Text>
      ) : null}
      {problem ? (
        <Text variant="callout" tone="dangerInk" accessibilityRole="alert">
          {problem}
        </Text>
      ) : null}
      {detail.canChange && !generating ? (
        <Button
          kind={detail.generated ? 'secondary' : 'primary'}
          label={t(detail.generated ? 'mom.minutesBar.again' : 'mom.minutesBar.generate')}
          onPress={() => void generate()}
          disabled={reasons.length > 0}
          busy={busy}
          testID="minutes-generate"
        />
      ) : null}
      {detail.canChange && reasons.length ? (
        <View style={styles.reasons}>
          {reasons.map((line) => (
            <Text key={line} variant="footnote" tone="inkSoft">
              {line}
            </Text>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

export function MinutesLinks({ detail }: { detail: Detail }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const team = !detail.isClient;
  const open = (part: MinutesPart) => router.push({ pathname: '/mom/minutes/[part]', params: { part, meeting: String(detail.meeting_id) } });
  const awaiting = detail.items.filter((item) => !item.decided).length;
  const rows = [
    detail.minutes ? { key: 'document' as const, icon: 'doc' as const, onPress: () => open('document') } : null,
    detail.dynamics && Object.keys(detail.dynamics).length ? { key: 'dynamics' as const, icon: 'people' as const, onPress: () => open('dynamics') } : null,
    team && detail.milestones?.length ? { key: 'milestones' as const, icon: 'flag' as const, onPress: () => open('milestones') } : null,
    team && detail.generated && detail.context ? { key: 'context' as const, icon: 'sparkle' as const, onPress: () => open('context') } : null,
    team && awaiting
      ? {
          key: 'review' as const,
          icon: 'chat' as const,
          onPress: () =>
            router.push({ pathname: '/program/[id]/coworker', params: { id: String(detail.programmeId), prefill: t('mom.minutesLinks.reviewText', { meeting: detail.meeting }) } }),
        }
      : null,
  ].filter((row) => row !== null);
  if (!rows.length) return null;
  return (
    <Section title={t('mom.minutesLinks.title')}>
      {rows.map((row) => (
        <Row
          key={row.key}
          title={t(`mom.minutesLinks.${row.key}`, { count: row.key === 'milestones' ? (detail.milestones?.length ?? 0) : awaiting })}
          leading={<Icon name={row.icon} size={20} color={colors.inkSoft} />}
          onPress={row.onPress}
          testID={`minutes-link-${row.key}`}
        />
      ))}
    </Section>
  );
}

export function ItemFilters({ items, filter, type, onFilter, onType }: { items: Item[]; filter: ItemFilter; type: string; onFilter: (next: ItemFilter) => void; onType: (next: string) => void }) {
  const { t } = useTranslation();
  const types = itemTypes(items);
  return (
    <View style={styles.filters}>
      <ChoiceRow options={itemFilters.map((value) => ({ value, label: t(`mom.itemFilters.${value}`) }))} value={filter} onChange={onFilter} testID="items-filter" />
      {types.length > 1 ? (
        <ChoiceRow
          options={[{ value: '', label: t('mom.itemFilters.anyType') }, ...types.map((one) => ({ value: one.type, label: `${one.label} ${one.count}` }))]}
          value={type}
          onChange={onType}
          testID="items-type"
        />
      ) : null}
    </View>
  );
}

export function ItemExtra({ item, team }: { item: Item; team: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const facts = [item.module, typeof item.confidence === 'number' ? t('mom.itemExtra.confidence', { value: Math.round(item.confidence * 100) }) : '', item.reviewedBy].filter(Boolean);
  return (
    <View style={styles.extra}>
      {facts.length ? (
        <Text variant="footnote" tone="inkSoft">
          {facts.join(' · ')}
        </Text>
      ) : null}
      {item.reviewNote || item.reason ? <Text variant="footnote">{item.reviewNote || item.reason}</Text> : null}
      {(item.followUps ?? []).map((one) => (
        <Text key={one.id} variant="footnote" tone="inkSoft">
          {`→ ${[one.code, one.name].filter(Boolean).join(' ')}${one.owner || one.due ? ` (${[one.owner, one.due].filter(Boolean).join(', ')})` : ''}`}
        </Text>
      ))}
      {team && item.finding ? (
        <Text
          variant="footnote"
          tone="link"
          accessibilityRole="link"
          onPress={() => router.push({ pathname: '/program/finding/[id]', params: { id: String((item.finding as { id: number }).id) } })}
          testID={`item-finding-${item.id}`}>
          {t('mom.itemExtra.finding', { name: item.finding.name })}
        </Text>
      ) : team && item.born ? (
        <Text variant="footnote" tone="inkSoft">
          {t('mom.itemExtra.born', { name: item.born.name })}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  reasons: { gap: space.xs },
  filters: { gap: space.xs },
  extra: { gap: space.xs },
});
