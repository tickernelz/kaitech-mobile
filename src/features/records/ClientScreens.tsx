import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rpc } from '../../api/odoo';
import { useResource } from '../../api/resource';
import { useSession } from '../../auth/session';
import { useFormatters } from '../../i18n';
import { radius, space, useTheme } from '../../theme';
import { Button } from '../../ui/Button';
import { Row, Section } from '../../ui/List';
import { Text } from '../../ui/Text';
import { TextField } from '../../ui/TextField';
import { parseServerDate } from '../discovery/dates';
import { Header } from '../discovery/Header';
import { KtBlockView } from '../discovery/KtBlockView';
import { KtDiagram } from '../discovery/kt/Diagram';
import { Chip, StateView } from '../discovery/ui';
import { useFailureAlert } from './Chatter';
import { architectureBlock, processBlock, type ArchitecturePayload, type DiagramPayload } from './shapes';
import { stash } from './stash';
import type { RecordStash } from './useRunAction';
import { Refresh } from '../../ui/Refresh';

function Shell({ title, subtitle, children, testID }: { title: string; subtitle?: string; children: ReactNode; testID: string }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID={testID}>
      <Header title={title} subtitle={subtitle} />
      {children}
    </SafeAreaView>
  );
}

export function MapScreen({ programme, id }: { programme: number; id: number }) {
  const { t } = useTranslation();
  const router = useRouter();
  const map = useResource(`records.map.${id}`, (account) => rpc<ArchitecturePayload>(account, 'ck.architecture', 'payload', [[id]]));
  const data = map.data;
  return (
    <Shell title={data?.title ?? t('records.map')} testID="map-screen">
      {!data ? (
        <StateView loading={map.loading || !map.error} error={map.error} onRetry={() => void map.refresh()} testID="map" />
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<Refresh onRefresh={map.refresh} />}>
          {data.nodes.length ? <KtDiagram block={architectureBlock(data, t('records.side'))} summary="" /> : null}
          {data.notes.map((note, index) => (
            <Text key={index} variant="callout">
              {note}
            </Text>
          ))}
          <Section title={t('records.parts')}>
            {data.nodes.map((node) => (
              <Row
                key={node.key}
                title={node.title}
                detail={[data.statuses.find(([key]) => key === node.status)?.[1], node.sub, node.gap].filter(Boolean).join(' · ')}
                onPress={() =>
                  router.push({
                    pathname: '/program/[id]/record',
                    params: { id: String(programme), model: 'ck.architecture.node', rid: String(node.id), stash: stash({ context: {}, formView: false, wizard: false } satisfies RecordStash) },
                  })
                }
                testID={`map-node-${node.id}`}
              />
            ))}
          </Section>
        </ScrollView>
      )}
    </Shell>
  );
}

export function DiagramScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const diagram = useResource(`records.diagram.${id}`, (account) => rpc<DiagramPayload>(account, 'ck.diagram', 'payload', [[id]]));
  const data = diagram.data;
  return (
    <Shell title={data?.title ?? t('records.diagram')} testID="diagram-screen">
      {!data ? (
        <StateView loading={diagram.loading || !diagram.error} error={diagram.error} onRetry={() => void diagram.refresh()} testID="diagram" />
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<Refresh onRefresh={diagram.refresh} />}>
          {data.block ? (
            <KtBlockView raw={JSON.stringify(data.block)} />
          ) : data.nodes.length ? (
            <KtDiagram block={processBlock(data, { doneBy: t('records.doneBy'), noActor: t('records.noActor'), process: t('records.process') })} summary="" />
          ) : (
            <StateView empty={{ title: t('records.diagramEmpty'), icon: 'steps' }} testID="diagram-empty" />
          )}
          {data.findings.length ? (
            <Section title={t('records.findings')}>
              {data.findings.map((finding, index) => (
                <Row key={index} title={finding} />
              ))}
            </Section>
          ) : null}
        </ScrollView>
      )}
    </Shell>
  );
}

type Overview = {
  engagement_name: string;
  documents: { doc_ref: string; title: string; standing: string; state: string; chunks: number; failure: string | false }[];
  page: { offset: number; limit: number; total: number };
  totals: { documents: number; chunks: number; embedded: number; waiting: number };
  failed: number;
  meaning_unavailable: string | false;
};

type Found = { results: { title: string; section: string; quote: string; doc_ref: string }[]; meaning_unavailable: string | false };

export function KnowledgeScreen({ programme }: { programme: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { number } = useFormatters();
  const account = useSession().active;
  const fail = useFailureAlert();
  const [offset, setOffset] = useState(0);
  const overview = useResource(`records.knowledge.${programme}.${offset}`, (signedIn) => rpc<Overview>(signedIn, 'ck.knowledge', 'overview_for', [programme], { offset, limit: 20 }));
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState<'search' | 'index' | null>(null);
  const data = overview.data;

  const search = async () => {
    if (!account || !query.trim()) return;
    setBusy('search');
    try {
      setFound(await rpc<Found>(account, 'ck.knowledge', 'search_for', [programme, query.trim()], { limit: 8 }));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const reindex = async () => {
    if (!account) return;
    setBusy('index');
    try {
      await rpc(account, 'ck.knowledge', 'reindex_for', [programme]);
      await overview.refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Shell title={t('records.knowledge')} subtitle={data?.engagement_name} testID="knowledge-screen">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<Refresh onRefresh={overview.refresh} />}>
        <TextField label={t('records.askKnowledge')} value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} returnKeyType="search" testID="knowledge-query" />
        <Button label={t('records.search')} busy={busy === 'search'} disabled={!query.trim() || busy !== null} onPress={() => void search()} testID="knowledge-search" />
        {found ? (
          <Section title={t('records.passages', { count: found.results.length })}>
            {found.results.map((passage, index) => (
              <View key={`${passage.doc_ref}-${index}`} style={styles.passage} testID={`knowledge-passage-${index}`}>
                <Text variant="footnote" tone="inkSoft">
                  {[passage.title, passage.section].filter(Boolean).join(' · ')}
                </Text>
                <Text variant="callout" selectable>
                  {passage.quote}
                </Text>
              </View>
            ))}
          </Section>
        ) : null}
        {!data ? (
          <StateView loading={overview.loading || !overview.error} error={overview.error} onRetry={() => void overview.refresh()} testID="knowledge" />
        ) : (
          <>
            <View style={[styles.summary, { borderColor: colors.line, backgroundColor: colors.surface }]}>
              <Text variant="callout">
                {t('records.knowledgeTotals', { documents: number(data.totals.documents), chunks: number(data.totals.chunks), waiting: number(data.totals.waiting) })}
              </Text>
              {data.meaning_unavailable ? (
                <Text variant="footnote" tone="warnInk">
                  {t('records.meaningOff')}
                </Text>
              ) : null}
              <Button kind="secondary" label={t('records.reindex')} busy={busy === 'index'} disabled={busy !== null} onPress={() => void reindex()} testID="knowledge-reindex" />
            </View>
            <Section title={t('records.documents')}>
              {data.documents.map((document) => (
                <Row
                  key={document.doc_ref}
                  title={document.title}
                  detail={[document.state === 'indexed' ? t('records.indexed', { count: document.chunks }) : t('records.waiting'), document.failure || ''].filter(Boolean).join(' · ')}
                  testID={`knowledge-doc-${document.doc_ref}`}
                />
              ))}
            </Section>
            {data.page.total > data.page.limit ? (
              <View style={styles.pager}>
                <Button kind="plain" label={t('records.previous')} disabled={offset === 0} onPress={() => setOffset(Math.max(0, offset - 20))} />
                <Chip label={`${offset + 1}-${Math.min(offset + 20, data.page.total)} / ${data.page.total}`} />
                <Button kind="plain" label={t('records.next')} disabled={offset + 20 >= data.page.total} onPress={() => setOffset(offset + 20)} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Shell>
  );
}

type Watch = { coworker: string; respondent: string; live: boolean; messages: { id: number; author: string; kind_label: string; body: string; out_of_scope: string; occurred_at: string }[] };

export function WatchScreen({ id }: { id: number }) {
  const { t } = useTranslation();
  const { date } = useFormatters();
  const watch = useResource(`records.watch.${id}`, (account) => rpc<Watch>(account, 'ck.interview', 'watch', [[id]]), 10_000);
  const data = watch.data;
  return (
    <Shell title={t('records.watch')} subtitle={data ? [data.respondent, data.live ? t('records.live') : ''].filter(Boolean).join(' · ') : undefined} testID="watch-screen">
      {!data ? (
        <StateView loading={watch.loading || !watch.error} error={watch.error} onRetry={() => void watch.refresh()} testID="watch" />
      ) : (
        <ScrollView contentContainerStyle={styles.content} refreshControl={<Refresh onRefresh={watch.refresh} />}>
          {!data.messages.length ? <StateView empty={{ title: t('records.watchEmpty'), icon: 'chat' }} testID="watch-empty" /> : null}
          {data.messages.map((message) => {
            const at = parseServerDate(message.occurred_at);
            return (
              <View key={message.id} style={styles.passage} testID={`watch-message-${message.id}`}>
                <Text variant="footnote" tone="inkSoft">
                  {[message.author === 'coworker' ? data.coworker : data.respondent || message.author, message.kind_label, at ? date(at) : ''].filter(Boolean).join(' · ')}
                </Text>
                <Text variant="callout" selectable>
                  {message.body}
                </Text>
                {message.out_of_scope ? (
                  <Text variant="footnote" tone="warnInk">
                    {message.out_of_scope}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </Shell>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl, gap: space.md, width: '100%', maxWidth: 720, alignSelf: 'center' },
  passage: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: 4 },
  summary: { borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: space.sm },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
