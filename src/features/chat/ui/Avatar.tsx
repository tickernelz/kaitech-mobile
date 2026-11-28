import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { avatarFill, useTheme } from '../../../theme';
import { initials } from '../../../screens/initials';
import { Text } from '../../../ui/Text';
import type { Photo } from '../../people/photo';
import { usePartnerPhoto } from '../../people/photos';
import { useChat } from '../chat';
import { useCookie } from './useCookie';
import { Icon, type IconName } from '../../../ui/icons';

const mediumFrom = 80;

export const Avatar = memo(function Avatar({
  name,
  seed,
  size = 48,
  icon,
  photo,
  partnerId,
}: {
  name: string;
  seed: number;
  size?: number;
  icon?: IconName;
  photo?: Photo | null;
  partnerId?: number | null;
}) {
  const { colors } = useTheme();
  const origin = useChat((state) => state.origin);
  const accountId = useChat((state) => state.accountId);
  const known = usePartnerPhoto(accountId, photo === undefined ? partnerId : null);
  const shown = photo === undefined ? known : photo;
  const large = size >= mediumFrom;
  const cookie = useCookie();
  const round = { borderRadius: size / 2 };
  const small = useMemo(() => (shown && origin ? { uri: `${origin}${shown.small}` } : null), [shown, origin]);
  const medium = useMemo(
    () => (large && shown && origin && cookie && shown.medium !== shown.small ? { uri: `${origin}${shown.medium}`, headers: cookie } : null),
    [large, shown, origin, cookie],
  );
  const frame = { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarFill(seed) };
  return (
    <View style={[styles.frame, frame]} accessible={false} importantForAccessibility="no-hide-descendants" testID={shown ? 'avatar-photo' : 'avatar-initials'}>
      {icon ? (
        <Icon name={icon} size={size * 0.46} color={colors.onFill} />
      ) : (
        <Text variant="headline" maxFontSizeMultiplier={1.2} style={{ color: colors.onFill, fontSize: size * 0.36, lineHeight: size * 0.44 }}>
          {initials(name)}
        </Text>
      )}
      {small ? <Image source={small} fadeDuration={0} style={[StyleSheet.absoluteFill, round]} testID="avatar-small" /> : null}
      {medium ? <Image source={medium} fadeDuration={0} style={[StyleSheet.absoluteFill, round]} testID="avatar-medium" /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
