import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';
import { Pressable } from './Pressable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pillCover } from '../layout/tabBar';
import { useWindowClass } from '../layout/windowClass';
import { radius, space, useTheme } from '../theme';
import { FloatingSurface } from './FloatingSurface';
import { useSurface } from './glass';
import { Text } from './Text';
import { flushUndo, primeUndoWindow, undoLast, useUndo, type UndoState } from './undo';

export function UndoBar({ clearTabs }: { clearTabs: boolean }) {
  const shown = useUndo();
  useEffect(() => {
    primeUndoWindow();
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') flushUndo();
    });
    return () => subscription.remove();
  }, []);
  return shown ? <Bar shown={shown} clearTabs={clearTabs} /> : null;
}

function Bar({ shown, clearTabs }: { shown: NonNullable<UndoState>; clearTabs: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { windowClass } = useWindowClass();
  const glass = useSurface() === 'glass';
  const ink = glass ? colors.ink : colors.canvas;
  const bottom = clearTabs && windowClass === 'compact' ? pillCover(insets.bottom) + space.sm : insets.bottom + space.lg;
  const plain = shown.failed || shown.notice;
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom }]}>
      <FloatingSurface
        solid={colors.ink}
        accessibilityLiveRegion="polite"
        style={[styles.bar, glass && styles.capsule]}
        testID={shown.notice ? 'snackbar' : shown.failed ? 'undo-failed' : 'undo-bar'}>
        <Text variant="callout" numberOfLines={shown.notice ? 4 : 2} style={[styles.flex, styles.line, { color: ink }]}>
          {shown.failed ? shown.label || t('row.failed') : shown.label}
        </Text>
        {plain ? null : (
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
  line: { paddingVertical: space.md },
  action: { minHeight: 44, minWidth: 64, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md },
  strong: { fontWeight: '600' },
});
