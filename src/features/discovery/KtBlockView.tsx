import * as Clipboard from 'expo-clipboard';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../theme';
import { Icon } from '../../ui/icons';
import { Text } from '../../ui/Text';
import { MONO } from './kt/Catalog';
import { useThread, webChatUrl, type Place } from './kt/place';
import { fallbackTable, frameIsSound, parseBlock, type Frame, type Source } from './kt/read';
import { kindOf } from './kt/registry';
import { KtTable } from './kt/Table';
import { DrawGuard, Tool } from './kt/ui';

const RAW_SHOWN = 2000;

function Sources({ sources }: { sources: Source[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!sources.length) return null;
  return (
    <View style={styles.sources} testID="kt-block-sources">
      <Text variant="footnote" tone="inkSoft">
        {t('discovery.block.sources')}
      </Text>
      {sources.map((source, index) => (
        <View key={index} style={[styles.source, { backgroundColor: colors.surface2 }]}>
          <Icon name="doc" size={12} color={colors.inkSoft} />
          <Text variant="label" tone="inkSoft">
            {source.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function OpenOnWeb() {
  const { t } = useTranslation();
  const { origin } = useThread();
  if (!origin) return null;
  return <Tool icon="external" label={t('discovery.block.openWeb')} onPress={() => void Linking.openURL(webChatUrl(origin))} testID="kt-block-web" />;
}

function Generic({ frame, data }: { frame: Frame; data: Record<string, unknown> }) {
  const table = useMemo(() => fallbackTable(data, ''), [data]);
  return (
    <View style={styles.gap} testID="kt-block-generic">
      {frame.title ? (
        <Text variant="headline" selectable>
          {frame.title}
        </Text>
      ) : null}
      {frame.summary ? <Text selectable>{frame.summary}</Text> : null}
      {table ? <KtTable block={table} place={null} exportable={false} /> : null}
      <Sources sources={frame.sources} />
      <View style={styles.tools}>
        <OpenOnWeb />
      </View>
    </View>
  );
}

function RawBlock({ raw }: { raw: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const shown = raw.length > RAW_SHOWN ? raw.slice(0, RAW_SHOWN) + '\u2026' : raw;
  return (
    <View style={styles.gap} testID="kt-block-raw">
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled style={[styles.raw, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
        <Text style={[styles.mono, { color: colors.ink }]} selectable>
          {shown}
        </Text>
      </ScrollView>
      <View style={styles.tools}>
        <Tool icon={copied ? 'check' : 'copy'} label={copied ? t('discovery.block.copied') : t('discovery.block.copy')} on={copied} onPress={() => void Clipboard.setStringAsync(raw).then(() => setCopied(true))} />
      </View>
    </View>
  );
}

export function KtBlockView({ raw, index = 0, place = null }: { raw: string; index?: number; place?: Omit<Place, 'index'> | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const parsed = useMemo(() => parseBlock(raw), [raw]);
  const kind = parsed.state === 'read' ? kindOf(parsed.frame.type) : null;
  const block = useMemo(() => (parsed.state === 'read' && kind && frameIsSound(parsed.data) ? kind.read(parsed.data) : null), [parsed, kind]);
  const at = useMemo<Place | null>(() => (place ? { ...place, index } : null), [place, index]);
  if (parsed.state === 'broken') {
    return (
      <View style={[styles.block, { borderColor: colors.line }]}>
        <RawBlock raw={raw} />
      </View>
    );
  }
  const { frame, data } = parsed;
  const generic = <Generic frame={frame} data={data} />;
  if (!kind || !block) {
    return <View style={[styles.block, { borderColor: colors.line }]}>{generic}</View>;
  }
  const View_ = kind.View;
  return (
    <View style={[styles.block, { borderColor: colors.line }]} testID={`kt-block-${frame.type}`}>
      <DrawGuard fallback={generic}>
        <View_ block={block} frame={frame} place={at} />
        {frame.summary ? (
          <Text variant="footnote" tone="inkSoft" selectable>
            {frame.summary}
          </Text>
        ) : null}
        <Sources sources={frame.sources} />
        <Text variant="label" tone="inkFaint">
          {t('discovery.block.draft')}
        </Text>
      </DrawGuard>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm },
  gap: { gap: space.sm },
  tools: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sources: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  source: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 3 },
  raw: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, maxHeight: 280 },
  mono: { fontFamily: MONO, fontSize: 12, lineHeight: 18, padding: space.md },
});
