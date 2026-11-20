import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSession } from '../auth/session';
import { space, useTheme } from '../theme';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || 'K';
}

export function TabScreen({ title, testID }: { title: string; testID: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { active } = useSession();
  return (
    <Screen edges={['top']} testID={testID}>
      <View style={styles.header}>
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tabs.profile')}
          hitSlop={8}
          onPress={() => router.push('/settings')}
          testID="open-settings"
          style={({ pressed }) => [styles.avatar, { backgroundColor: colors.select, opacity: pressed ? 0.8 : 1 }]}>
          <Text variant="label" tone="selectInk">
            {initials(active?.name ?? '')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.empty}>
        <Text variant="headline">{t('tabs.comingTitle')}</Text>
        <Text tone="inkSoft" style={styles.center}>
          {t('tabs.comingBody')}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { flex: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingBottom: space.xxxl },
  center: { textAlign: 'center' },
});
