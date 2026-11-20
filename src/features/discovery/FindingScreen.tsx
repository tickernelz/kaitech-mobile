import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { FindingView } from './FindingView';
import { Header } from './Header';

export function FindingScreen({ id, programme }: { id: number; programme?: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.fill, { backgroundColor: colors.canvas }]} testID="finding-screen">
      <Header title={t('discovery.finding.title')} />
      <FindingView id={id} programme={programme} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
