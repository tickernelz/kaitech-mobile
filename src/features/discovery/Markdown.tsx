import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../../theme';
import { sourceBlocks } from '../chat/markdown';
import { RichText } from '../chat/ui/RichText';
import { splitBlocks } from './blocks';
import { KtBlockView } from './KtBlockView';
import type { BlockReads } from './kt/place';

export const Markdown = memo(function Markdown({ text, turnId = null, seq = null, reads = null }: { text: string; turnId?: number | null; seq?: number | null; reads?: BlockReads | null }) {
  const segments = useMemo(() => splitBlocks(text), [text]);
  let block = 0;
  return (
    <View style={styles.wrap}>
      {segments.map((segment, index) =>
        segment.kind === 'block' ? (
          <KtBlockView key={index} raw={segment.raw} index={block++} turnId={turnId} seq={seq} reads={reads} />
        ) : (
          <RichText key={index} blocks={sourceBlocks(segment.text, true)} selectable />
        ),
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
});
