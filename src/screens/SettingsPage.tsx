import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { space, useTheme } from '../theme';
import { Icon, type IconName } from '../ui/icons';
import { IconButton } from '../ui/IconButton';
import { Screen } from '../ui/Screen';
import { Text } from '../ui/Text';

export function SettingsPage({ title, children, testID, root = false }: { title: string; children: ReactNode; testID: string; root?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Screen scroll testID={testID} contentStyle={styles.content}>
      <View style={styles.header}>
        {root ? null : <IconButton icon="back" label={t('settings.back')} onPress={() => router.back()} testID="settings-back" />}
        <Text variant="title" accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {root ? <IconButton icon="close" label={t('settings.close')} onPress={() => router.back()} testID="settings-close" /> : null}
      </View>
      {children}
    </Screen>
  );
}

export function RowIcon({ name }: { name: IconName }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.icon, { backgroundColor: colors.select }]}>
      <Icon name={name} size={20} color={colors.selectInk} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxxl, gap: space.xl },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
