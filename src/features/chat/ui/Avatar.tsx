import { memo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../theme';
import { initials } from '../../../screens/initials';
import { Text } from '../../../ui/Text';
import { useChat } from '../chat';
import { useCookie } from './useCookie';
import { Icon, type IconName } from './icons';

const tints = [
  ['#F0E7FC', '#472268'],
  ['#DCF7E2', '#0D6332'],
  ['#FFEECB', '#7D4A07'],
  ['#E4F0FF', '#225899'],
  ['#FFE7E6', '#B91C1E'],
] as const;

function tintFor(seed: number) {
  return tints[Math.abs(seed) % tints.length];
}

export const Avatar = memo(function Avatar({
  name,
  path,
  seed,
  size = 48,
  icon,
}: {
  name: string;
  path?: string;
  seed: number;
  size?: number;
  icon?: IconName;
}) {
  const { scheme } = useTheme();
  const origin = useChat((state) => state.origin);
  const cookie = useCookie();
  const [band, ink] = tintFor(seed);
  const background = scheme === 'dark' ? ink : band;
  const foreground = scheme === 'dark' ? band : ink;
  const frame = { width: size, height: size, borderRadius: size / 2, backgroundColor: background };
  return (
    <View style={[styles.frame, frame]} accessible={false} importantForAccessibility="no-hide-descendants">
      {icon ? (
        <Icon name={icon} size={size * 0.46} color={foreground} />
      ) : (
        <Text variant="headline" maxFontSizeMultiplier={1.2} style={{ color: foreground, fontSize: size * 0.36, lineHeight: size * 0.44 }}>
          {initials(name)}
        </Text>
      )}
      {path && /^\/(?!\/)/.test(path) && cookie && origin ? (
        <Image source={{ uri: `${origin}${path}`, headers: cookie }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
