import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSession } from '../auth/session';
import { radius, space, useTheme } from '../theme';
import { initials } from '../ui/initials';
import { Text } from '../ui/Text';

const searchIcon = 'M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.3 4.3-1.4 1.4-4.3-4.3A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z';

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
        <Svg width={22} height={22} viewBox="0 0 24 24" accessible={false}>
          <Path d={searchIcon} fill={colors.ink} />
        </Svg>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tabs.profile')}
        onPress={() => router.push('/settings')}
        testID="open-settings"
        style={({ pressed }) => [styles.round, styles.avatar, { backgroundColor: colors.select, opacity: pressed ? 0.8 : 1 }]}>
        <Text variant="label" tone="selectInk">
          {initials(active?.name ?? '')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  round: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  avatar: { borderWidth: 0 },
});
