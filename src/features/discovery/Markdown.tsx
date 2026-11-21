import { StyleSheet, View } from 'react-native';
import { space } from '../../theme';
import { sourceBlocks } from '../chat/markdown';
import { RichText } from '../chat/ui/RichText';
import { splitBlocks } from './blocks';
import { KtBlockView } from './KtBlockView';

export function Markdown({ text, onReply }: { text: string; onReply?: (reply: string) => void }) {
  return (
    <View style={styles.wrap}>
      {splitBlocks(text).map((segment, index) =>
        segment.kind === 'block' ? (
          <KtBlockView key={index} raw={segment.raw} onReply={onReply} />
        ) : (
          <RichText key={index} blocks={sourceBlocks(segment.text, true)} selectable />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
});
