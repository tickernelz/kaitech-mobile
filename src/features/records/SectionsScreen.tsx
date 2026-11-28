import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../ui/Pressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResource } from '../../api/resource';
import { radius, space, stroke, useTheme } from '../../theme';
import { Icon } from '../../ui/icons';
import { IconButton } from '../../ui/IconButton';
import { Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { Header } from '../discovery/Header';
import { StateView } from '../discovery/ui';
import { useSession } from '../../auth/session';
import { loadAction, sectionGroups, type SectionGroup, type SectionLink } from './api';
import { useFailureAlert } from './Chatter';
import { stash } from './stash';
import { useRunAction, type RecordStash } from './useRunAction';
import { Refresh } from '../../ui/Refresh';

export function SectionsScreen({ programme, name }: { programme: number; name?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const groups = useResource('records.sections', sectionGroups, 5 * 60_000);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const id = String(programme);
  const account = useSession().active;
  const run = useRunAction(programme);
  const fail = useFailureAlert();

  const openSection = (section: SectionLink) => {
    if (section.actionModel === 'ir.actions.act_window') {
      router.push({ pathname: '/program/[id]/list', params: { id, action: String(section.actionId) } });
      return;
    }
    if (!account) return;
    loadAction(account, section.actionId, { default_engagement_id: programme })
      .then((action) => run(action))
      .catch(fail);
  };

  const shown: SectionGroup[] = useMemo(() => {
    const said = query.trim().toLowerCase();
    const all = groups.data ?? [];
    if (!said) return all;
    return all
      .map((group) => ({ ...group, sections: group.sections.filter((section) => section.name.toLowerCase().includes(said) || group.name.toLowerCase().includes(said)) }))
      .filter((group) => group.sections.length);
  }, [groups.data, query]);

  const toggle = (group: number) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="sections-screen">
      <Header title={t('records.sections')} subtitle={name} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<Refresh onRefresh={groups.refresh} />}>
        <Section>
          <Row
            title={t('records.programme')}
            detail={t('records.programmeDetail')}
            onPress={() =>
              router.push({ pathname: '/program/[id]/record', params: { id, model: 'ck.engagement', rid: id, stash: stash({ context: {}, formView: false, wizard: false } satisfies RecordStash) } })
            }
            testID="sections-programme"
          />
          <Row title={t('records.knowledge')} detail={t('records.knowledgeDetail')} onPress={() => router.push({ pathname: '/program/[id]/knowledge', params: { id } })} testID="sections-knowledge" />
        </Section>
        <View style={styles.searchRow}>
          <View style={styles.fill}>
            <TextField label={t('records.findSection')} value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" testID="sections-search" />
          </View>
          {query ? <IconButton icon="close" label={t('records.clear')} onPress={() => setQuery('')} testID="sections-search-clear" /> : null}
        </View>
        {!groups.data ? (
          <StateView loading={groups.loading || !groups.error} error={groups.error} onRetry={() => void groups.refresh()} testID="sections" />
        ) : (
          shown.map((group) => {
            const expanded = !!query.trim() || open.has(group.id);
            return (
              <View key={group.id} style={[styles.group, { borderColor: colors.line, backgroundColor: colors.surface }]}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  onPress={() => toggle(group.id)}
                  style={({ pressed }) => [styles.groupHead, pressed && { backgroundColor: colors.surface2 }]}
                  testID={`sections-group-${group.id}`}>
                  <Text variant="callout" style={[styles.fill, styles.strong]}>
                    {group.name}
                  </Text>
                  <Text variant="footnote" tone="inkSoft">
                    {group.sections.length}
                  </Text>
                  <Icon name={expanded ? 'arrowUp' : 'chevronDown'} size={20} color={colors.inkSoft} />
                </Pressable>
                {expanded
                  ? group.sections.map((section) => (
                      <Row
                        key={section.menuId}
                        title={section.name}
                        onPress={() => openSection(section)}
                        testID={`section-${section.menuId}`}
                      />
                    ))
                  : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  strong: { fontWeight: '600' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl, gap: space.md, width: '100%', maxWidth: 720, alignSelf: 'center' },
  group: { borderRadius: radius.card, borderWidth: stroke.thin, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingHorizontal: space.lg },
});
