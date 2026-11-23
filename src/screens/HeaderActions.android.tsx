import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '../ui/Pressable';
import { useSession } from '../auth/session';
import { radius, space, useTheme } from '../theme';
import { IconButton } from '../ui/IconButton';
import { Avatar } from '../features/chat/ui/Avatar';

export function HeaderActions() {
  const { t } = useTranslation();
  const { material } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  return (
    <View style={styles.row}>
      <IconButton icon="search" label={t('search.open')} onPress={() => router.push('/search')} testID="open-search" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tabs.profile')}
        onPress={() => router.push('/settings')}
        hitSlop={4}
        android_ripple={{ color: `${material.onSurface}1A`, foreground: true }}
        testID="open-settings"
        style={styles.avatar}>
        <Avatar name={active?.name ?? ''} seed={active?.partnerId ?? 0} partnerId={active?.partnerId} size={avatarSize} />
      </Pressable>
    </View>
  );
}

const avatarSize = 40;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  avatar: { width: avatarSize, height: avatarSize, margin: 2, borderRadius: radius.pill, overflow: 'hidden' },
});
