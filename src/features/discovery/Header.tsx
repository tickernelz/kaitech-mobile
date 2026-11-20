import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { space } from '../../theme';
import { Text } from '../../ui/Text';
import { IconButton } from './ui';

export function Header({
  title,
  subtitle,
  back = true,
  actions,
  testID,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  actions?: ReactNode;
  testID?: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={styles.header} testID={testID}>
      {back ? (
        <IconButton
          icon="back"
          label={t('discovery.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/discovery'))}
          testID="header-back"
        />
      ) : null}
      <View style={styles.titles}>
        <Text variant="headline" accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="inkSoft" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm, minHeight: 56 },
  titles: { flex: 1, gap: 2 },
});
