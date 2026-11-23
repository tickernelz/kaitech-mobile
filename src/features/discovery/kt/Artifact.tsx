import { lazy, memo, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Pressable } from '../../../ui/Pressable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radius, space, useTheme } from '../../../theme';
import { Icon } from '../../../ui/icons';
import { Text } from '../../../ui/Text';
import type { TranscriptItem } from '../api';
import { splitBlocks } from '../blocks';
import { useItems, useThread, webChatUrl, type Place } from './place';
import { parseBlock, readArtifact, type ArtifactBlock } from './read';
import { Tool, styles as shared } from './ui';

const SealedFrame = lazy(() => Promise.resolve(require('./SealedFrame') as typeof import('./SealedFrame')));

export const MAX_VERSIONS = 20;
export const SEAL = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  'img-src data: blob:',
  'font-src data:',
  "connect-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join('; ');

export type Version = { turnId: number | null; seq: number | null; index: number; block: ArtifactBlock; number: number };

export function sealed(html: string): string {
  return (
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta http-equiv="Content-Security-Policy" content="' +
    SEAL +
    '">' +
    '<meta http-equiv="x-dns-prefetch-control" content="off"><meta name="referrer" content="no-referrer">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '</head><body>' +
    html +
    '</body></html>'
  );
}

export const SEALED_ORIGINS = ['*'];

export function allowsLoad(url: string): boolean {
  return url === 'about:blank' || url.startsWith('about:blank#');
}

export function versionsOf(items: TranscriptItem[], block: ArtifactBlock, place: Place | null): { versions: Version[]; own: Version } {
  const found: Omit<Version, 'number'>[] = [];
  for (const item of items) {
    if (!item.body || !item.body.includes('"artifact"')) continue;
    let index = 0;
    for (const segment of splitBlocks(item.body)) {
      if (segment.kind !== 'block') continue;
      const position = index++;
      if (!segment.raw.includes('"artifact"')) continue;
      const parsed = parseBlock(segment.raw);
      if (parsed.state !== 'read' || parsed.data.type !== 'artifact') continue;
      const read = readArtifact(parsed.data);
      if (read && read.title === block.title) found.push({ turnId: item.turnId, seq: item.seq, index: position, block: read });
    }
  }
  const mine = { turnId: place?.turnId ?? null, seq: place?.seq ?? null, index: place?.index ?? 0, block };
  const numbered = (found.length ? found : [mine]).map((version, position) => ({ ...version, number: position + 1 }));
  const own = numbered.find((version) => version.turnId === mine.turnId && version.seq === mine.seq && version.index === mine.index);
  return { versions: numbered, own: own ?? { ...mine, number: numbered.length + 1 } };
}

function Screen({ versions, start, onClose }: { versions: Version[]; start: Version; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { origin } = useThread();
  const [picked, setPicked] = useState(start.number);
  const shown = versions.find((version) => version.number === picked) ?? start;
  const kept = versions.slice(-MAX_VERSIONS);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <SafeAreaView style={[styles.screen, { backgroundColor: colors.canvas }]}>
        <View style={styles.head}>
          <View style={shared.grow}>
            <Text variant="headline" numberOfLines={2}>
              {shown.block.title}
            </Text>
            {shown.block.change ? (
              <Text variant="footnote" tone="inkSoft" numberOfLines={2}>
                {shown.block.change}
              </Text>
            ) : null}
          </View>
          <Tool icon="close" label={t('discovery.block.close')} hideLabel onPress={onClose} testID="kt-artifact-close" />
        </View>
        {kept.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.versions} style={styles.versionStrip}>
            {kept.map((version) => {
              const on = version.number === shown.number;
              return (
                <Pressable
                  key={version.number}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  onPress={() => setPicked(version.number)}
                  style={[styles.version, { borderColor: on ? colors.primary : colors.line, backgroundColor: on ? colors.select : colors.surface }]}>
                  <Text variant="label" tone={on ? 'selectInk' : 'inkSoft'}>
                    {t('discovery.block.artifact.version', { number: version.number })}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <View style={[styles.stage, { borderColor: colors.line }]}>
          <Suspense fallback={<ActivityIndicator style={styles.frame} color={colors.primary} />}>
            <SealedFrame key={shown.number} html={shown.block.html} testID="kt-artifact-frame" />
          </Suspense>
        </View>
        <View style={styles.foot}>
          <Icon name="lock" size={14} color={colors.inkSoft} />
          <Text variant="label" tone="inkSoft" style={shared.grow}>
            {t('discovery.block.artifact.sealed')}
          </Text>
          {origin ? <Tool icon="external" label={t('discovery.block.openWeb')} onPress={() => void Linking.openURL(webChatUrl(origin))} /> : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

export const KtArtifact = memo(function KtArtifact({ block, place }: { block: ArtifactBlock; place: Place | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { origin } = useThread();
  const items = useItems();
  const [open, setOpen] = useState(false);
  const { versions, own } = useMemo(() => versionsOf(items, block, place), [items, block, place]);
  return (
    <View style={[styles.card, { borderColor: colors.line, backgroundColor: colors.surface2 }]} testID="kt-artifact">
      <View style={styles.cardHead}>
        <View style={[styles.mark, { backgroundColor: colors.select }]}>
          <Icon name="sparkle" size={18} color={colors.selectInk} />
        </View>
        <View style={shared.grow}>
          <Text variant="callout" style={styles.bold}>
            {block.title}
          </Text>
          <Text variant="label" tone="inkSoft">
            {versions.length > 1 ? t('discovery.block.artifact.versionOf', { number: own.number, count: versions.length }) : t('discovery.block.artifact.kind')}
            {block.change ? ' \u00b7 ' + block.change : ''}
          </Text>
        </View>
      </View>
      <View style={shared.tools}>
        <Tool icon="play" label={t('discovery.block.artifact.open')} on onPress={() => setOpen(true)} testID="kt-artifact-open" />
        {origin ? <Tool icon="external" label={t('discovery.block.openWeb')} onPress={() => void Linking.openURL(webChatUrl(origin))} testID="kt-artifact-web" /> : null}
      </View>
      {open ? <Screen versions={versions} start={own} onClose={() => setOpen(false)} /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, padding: space.md, gap: space.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  bold: { fontWeight: '700' },
  screen: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
  versionStrip: { flexGrow: 0 },
  versions: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  version: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  stage: { flex: 1, marginHorizontal: space.lg, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, overflow: 'hidden' },
  frame: { flex: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.lg },
});
