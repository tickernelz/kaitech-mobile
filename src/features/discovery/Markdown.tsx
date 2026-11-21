import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '../../theme';
import { Text } from '../../ui/Text';
import { splitBlocks } from './blocks';
import { KtBlockView } from './KtBlockView';

type Block = { kind: 'paragraph' | 'bullet' | 'heading'; text: string };

export function blocksOf(source: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;
    const bullet = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    if (bullet) blocks.push({ kind: 'bullet', text: bullet[1] });
    else if (heading) blocks.push({ kind: 'heading', text: heading[1] });
    else if (blocks.at(-1)?.kind === 'paragraph') blocks[blocks.length - 1].text += `\n${line.trim()}`;
    else blocks.push({ kind: 'paragraph', text: line.trim() });
  }
  return blocks;
}

export function spansOf(text: string): { text: string; strong: boolean }[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part) => (part.startsWith('**') && part.endsWith('**') && part.length > 4 ? { text: part.slice(2, -2), strong: true } : { text: part, strong: false }));
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {spansOf(text).map((span, index) => (
        <Fragment key={index}>{span.strong ? <Text style={styles.strong}>{span.text}</Text> : span.text}</Fragment>
      ))}
    </>
  );
}

function Prose({ text }: { text: string }) {
  return (
    <>
      {blocksOf(text).map((block, index) =>
        block.kind === 'bullet' ? (
          <View key={index} style={styles.bullet}>
            <Text>{'\u2022'}</Text>
            <Text style={styles.fill}>
              <Inline text={block.text} />
            </Text>
          </View>
        ) : (
          <Text key={index} variant={block.kind === 'heading' ? 'headline' : 'body'} selectable>
            <Inline text={block.text} />
          </Text>
        ),
      )}
    </>
  );
}

export function Markdown({ text, onReply }: { text: string; onReply?: (reply: string) => void }) {
  return (
    <View style={styles.wrap}>
      {splitBlocks(text).map((segment, index) =>
        segment.kind === 'block' ? (
          <KtBlockView key={index} raw={segment.raw} onReply={onReply} />
        ) : (
          <Prose key={index} text={segment.text} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  bullet: { flexDirection: 'row', gap: space.sm, paddingRight: space.sm },
  fill: { flex: 1 },
  strong: { fontWeight: '700' },
});
