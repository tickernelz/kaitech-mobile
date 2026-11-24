import { GlassView } from 'expo-glass-effect';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Pressable } from '../ui/Pressable';
import { useSession } from '../auth/session';
import { radius, space, useTheme } from '../theme';
import { Icon } from '../ui/icons';
import { Avatar } from '../features/chat/ui/Avatar';
import { useSurface } from '../ui/glass';

export function HeaderActions() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  const glass = useSurface() === 'glass';
  const Row = glass ? GlassView : View;
  return (
    <Row isInteractive={glass || undefined} style={[styles.row, glass && styles.glass]} testID="header-actions">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('search.open')}
        onPress={() => router.push('/search')}
        testID="open-search"
        style={({ pressed }) => [styles.round, glass ? styles.bare : { backgroundColor: pressed ? colors.surface2 : colors.surface, borderColor: colors.line }]}>
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
    </Row>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  round: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  avatar: { borderWidth: 0 },
  bare: { borderWidth: 0 },
  glass: { borderRadius: radius.pill, padding: 2, gap: 2 },
});
