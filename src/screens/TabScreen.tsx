import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Panes } from '../layout/Panes';
import { space, useTheme } from '../theme';
import { Text } from '../ui/Text';
import { Wordmark } from '../ui/Wordmark';
import { HeaderActions } from './HeaderActions';

export function TabScreen({ title, testID }: { title: string; testID: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const list = (
    <View style={styles.pane}>
      <View style={styles.header}>
        <Text variant="display" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        <HeaderActions />
      </View>
      <View style={styles.empty}>
        <Text variant="headline" style={styles.center}>
          {t('tabs.comingTitle')}
        </Text>
        <Text tone="inkSoft" style={styles.center}>
          {t('tabs.comingBody')}
        </Text>
      </View>
    </View>
  );
  const detail = (
    <View style={[styles.detail, { backgroundColor: colors.surface2 }]} importantForAccessibility="no-hide-descendants">
      <View style={styles.faint}>
        <Wordmark width={160} label={t('app.name')} />
      </View>
    </View>
  );
  return (
    <SafeAreaView edges={['top', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID={testID}>
      <Panes list={list} detail={detail} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  pane: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  title: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingBottom: space.xxxl },
  center: { textAlign: 'center' },
  detail: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  faint: { opacity: 0.25 },
});
