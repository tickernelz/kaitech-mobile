import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowClass } from '../layout/windowClass';
import { radius, space, useTheme } from '../theme';
import { FloatingSurface } from './FloatingSurface';
import { useSurface } from './glass';
import { Text } from './Text';
import { flushUndo, primeUndoWindow, undoLast, useUndo } from './undo';

const tabBarClearance = 76;

export function UndoBar() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { windowClass } = useWindowClass();
  const shown = useUndo();
  const glass = useSurface() === 'glass';
  useEffect(() => {
    primeUndoWindow();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') flushUndo();
    });
    return () => subscription.remove();
  }, []);
  if (!shown) return null;
  const ink = glass ? colors.ink : colors.canvas;
  const bottom = insets.bottom + (windowClass === 'compact' ? tabBarClearance : space.lg);
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <FloatingSurface
        solid={colors.ink}
        accessibilityLiveRegion="polite"
        style={[styles.bar, glass && styles.capsule]}
        testID={shown.failed ? 'undo-failed' : 'undo-bar'}>
        <Text variant="callout" numberOfLines={2} style={[styles.flex, { color: ink }]}>
          {shown.failed ? shown.label || t('row.failed') : shown.label}
        </Text>
        {shown.failed ? null : (
          <Pressable accessibilityRole="button" onPress={undoLast} hitSlop={8} style={styles.action} testID="undo-action">
            <Text variant="callout" style={[styles.strong, { color: ink }]}>
              {t('row.undo')}
            </Text>
          </Pressable>
        )}
      </FloatingSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: space.lg },
  bar: { width: '100%', maxWidth: 560, minHeight: 48, borderRadius: radius.md, paddingLeft: space.lg, paddingRight: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md },
  capsule: { borderRadius: radius.pill },
  action: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  strong: { fontWeight: '600' },
});
