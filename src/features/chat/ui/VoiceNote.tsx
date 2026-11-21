import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { radius, space, useTheme } from '../../../theme';
import { Text } from '../../../ui/Text';
import { cycleVoiceRate, toggleVoice, useVoice } from '../voicePlayer';
import { useChatFormat } from './format';
import { Icon } from './icons';
import { useCookie } from './useCookie';

const barCount = 28;

function bars(seed: number): number[] {
  let value = seed * 2654435761;
  return Array.from({ length: barCount }, () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    return 0.25 + (value % 1000) / 1333;
  });
}

export const VoiceNote = memo(function VoiceNote({ id, uri, mine, seed }: { id: string; uri: string; mine: boolean; seed: number }) {
  const { t } = useTranslation('chat');
  const { colors } = useTheme();
  const { duration } = useChatFormat();
  const voice = useVoice();
  const cookie = useCookie();
  const current = voice.id === id;
  const playing = current && voice.playing;
  const progress = current && voice.duration ? voice.position / voice.duration : 0;
  const heights = bars(seed);
  return (
    <View style={[styles.row, { backgroundColor: mine ? colors.surface : colors.surface2 }]} testID={`voice-${id}`}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? t('voice.pause') : t('voice.play')}
        onPress={() => void toggleVoice(id, uri, cookie ?? undefined)}
        testID={`voice-toggle-${id}`}
        style={({ pressed }) => [styles.play, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name={playing ? 'pause' : 'play'} color={colors.onPrimary} />
      </Pressable>
      <View style={styles.flex}>
        <View style={styles.wave} accessible={false}>
          {heights.map((height, index) => (
            <View
              key={index}
              style={[styles.bar, { height: 4 + height * 20, backgroundColor: index / barCount < progress ? colors.primary : colors.lineStrong }]}
            />
          ))}
        </View>
        <Text variant="label" tone="inkSoft" style={styles.regular}>
          {current ? `${duration(voice.position)} / ${duration(voice.duration)}` : t('voice.label')}
        </Text>
      </View>
      {current ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('voice.speed', { rate: voice.rate })} onPress={cycleVoiceRate} style={[styles.rate, { borderColor: colors.line }]}>
          <Text variant="label">{`${voice.rate}\u00d7`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  regular: { fontWeight: '400' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.md, minWidth: 220 },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 26 },
  bar: { width: 3, borderRadius: 2 },
  rate: { minWidth: 44, minHeight: 32, paddingHorizontal: space.xs, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
