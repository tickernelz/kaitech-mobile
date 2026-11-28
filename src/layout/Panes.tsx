import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
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
      <View style={styles.fill}>{detail}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
  list: { width: listPaneWidth, borderRightWidth: StyleSheet.hairlineWidth },
});
