import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSession } from '../auth/session';
import { radius, space, useTheme } from '../theme';
import { Icon } from '../ui/icons';
import { Avatar } from '../features/chat/ui/Avatar';

export function HeaderActions() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('search.open')}
        onPress={() => router.push('/search')}
        testID="open-search"
        style={({ pressed }) => [styles.round, { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}>
        <Icon name="search" color={colors.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tabs.profile')}
        onPress={() => router.push('/settings')}
        testID="open-settings"
        style={({ pressed }) => [styles.round, styles.avatar, { opacity: pressed ? 0.8 : 1 }]}>
        <Avatar name={active?.name ?? ''} seed={active?.partnerId ?? 0} partnerId={active?.partnerId} size={44} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  round: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  avatar: { borderWidth: 0 },
});
