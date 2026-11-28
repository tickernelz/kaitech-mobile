import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { hideWhen, useCovered } from '../ui/cover';
import { listPaneWidth, useWindowClass } from './windowClass';

export function Panes({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  const { windowClass } = useWindowClass();
  const { colors } = useTheme();
  const covered = useCovered();
  if (windowClass !== 'expanded') return <View style={styles.fill}>{list}</View>;
  return (
    <View style={[styles.fill, styles.row]}>
      <View style={[styles.list, { borderColor: colors.line }]} importantForAccessibility={hideWhen(covered)}>
        {list}
      </View>
      <SafeAreaView edges={['top']} style={styles.fill}>
        {detail}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  list: { width: listPaneWidth, borderRightWidth: StyleSheet.hairlineWidth },
});
