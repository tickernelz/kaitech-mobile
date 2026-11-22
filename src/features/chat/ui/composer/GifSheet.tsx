import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { radius, space, useTheme } from '../../../../theme';
import { Sheet } from '../../../../ui/Sheet';
import { Text } from '../../../../ui/Text';
import { searchGifs, type Gif } from '../../composerExtras';
import type { Result } from '../../messageActions';
import { failureText } from '../actions/failure';

export function GifSheet({ onPick, onClose }: { onPick: (gif: Gif) => void; onClose: () => void }) {
  const { t, i18n } = useTranslation('chat');
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Result<{ gifs: Gif[]; next: string | null }> | null>(null);
  const term = query.trim();
  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const timer = setTimeout(() => void searchGifs(term, i18n.language === 'id' ? 'id' : 'en', null).then((next) => live && setResult(next)), 350);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [i18n.language, term]);
  return (
    <Sheet title={t('extras.gif')} onClose={onClose} testID="gif-sheet">
      <TextInput
        value={query}
        onChangeText={setQuery}
        autoFocus
        placeholder={t('extras.gifSearch')}
        placeholderTextColor={colors.inkFaint}
        accessibilityLabel={t('extras.gifSearch')}
        style={[styles.input, { backgroundColor: colors.surface2, color: colors.ink }]}
        testID="gif-search"
      />
      {term.length >= 2 && !result ? <ActivityIndicator color={colors.primary} style={styles.pad} /> : null}
      {term.length >= 2 && result && !result.ok ? (
        <Text variant="callout" tone="danger">
          {failureText(t, result)}
        </Text>
      ) : null}
      {term.length >= 2 && result?.ok ? (
        <View style={styles.grid}>
          {result.value.gifs.map((gif) => (
            <Pressable key={gif.id} accessibilityRole="button" accessibilityLabel={t('extras.gifSend')} onPress={() => onPick(gif)} style={styles.cell}>
              <Image source={{ uri: gif.url }} style={[styles.image, { aspectRatio: gif.width / gif.height, backgroundColor: colors.surface2 }]} resizeMode="cover" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  pad: { padding: space.lg },
  input: { minHeight: 44, borderRadius: radius.field, paddingHorizontal: space.md, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  cell: { width: '48%' },
  image: { width: '100%', borderRadius: radius.md },
});
