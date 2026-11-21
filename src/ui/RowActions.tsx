import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { radius, space, useTheme } from '../theme';
import { ActionSheet, type SheetAction } from './ActionSheet';
import { Icon } from './icons';
import { Text } from './Text';

export type RowBind = {
  onLongPress: () => void;
  delayLongPress: number;
  accessibilityActions: AccessibilityActionInfo[];
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
};

const moreKey = 'more';
const longPressMs = 420;

export function swipeActionsFor(actions: SheetAction[], keys: string[], more: SheetAction): SheetAction[] {
  const byKey = new Map(actions.map((action) => [action.key, action]));
  return keys.flatMap((key) => (key === moreKey ? [more] : byKey.has(key) ? [byKey.get(key) as SheetAction] : []));
}

export function accessibilityActionsFor(actions: SheetAction[], moreLabel: string): AccessibilityActionInfo[] {
  return [{ name: 'longpress', label: moreLabel }, ...actions.map((action) => ({ name: action.key, label: action.label }))];
}

function SwipePanel({ actions, side, testID, methods, onRun }: { actions: SheetAction[]; side: 'start' | 'end'; testID: string; methods: SwipeableMethods; onRun: (action: SheetAction) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.panel, side === 'end' && styles.panelEnd]} testID={`${testID}-swipe-${side}`}>
      {actions.map((action) => {
        const danger = action.tone === 'danger';
        const neutral = action.key === moreKey;
        const background = danger ? colors.dangerBand : neutral ? colors.surface2 : colors.select;
        const ink = danger ? colors.dangerInk : neutral ? colors.ink : colors.selectInk;
        return (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={() => {
              methods.close();
              onRun(action);
            }}
            style={({ pressed }) => [styles.swipeButton, { backgroundColor: background, opacity: pressed ? 0.8 : 1 }]}
            testID={`${testID}-swipe-${action.key}`}>
            <Icon name={action.icon} size={22} color={ink} />
            <Text variant="label" numberOfLines={1} style={{ color: ink }}>
              {action.short ?? action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RowActions({
  title,
  subtitle,
  actions,
  start = [],
  end = [moreKey],
  testID,
  children,
}: {
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  start?: string[];
  end?: string[];
  testID: string;
  children: (bind: RowBind) => ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [sheet, setSheet] = useState<{ initial?: string } | null>(null);
  const [keyFocus, setKeyFocus] = useState(false);
  const more: SheetAction = { key: moreKey, icon: 'more', label: t('row.more'), short: t('row.more') };
  const run = (action: SheetAction) => {
    if (action.key === moreKey) setSheet({});
    else if (action.choices) setSheet({ initial: action.key });
    else action.onPress?.();
  };
  const bind: RowBind = {
    delayLongPress: longPressMs,
    onLongPress: () => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSheet({});
    },
    accessibilityActions: accessibilityActionsFor(actions, more.label),
    onAccessibilityAction: (event) => {
      const name = event.nativeEvent.actionName;
      if (name === 'longpress') return setSheet({});
      const action = actions.find((candidate) => candidate.key === name);
      if (action) run(action);
    },
  };
  const startActions = swipeActionsFor(actions, start, more);
  const endActions = swipeActionsFor(actions, end, more);
  return (
    <>
      <ReanimatedSwipeable
        friction={1.6}
        leftThreshold={48}
        rightThreshold={48}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={
          startActions.length ? (_progress, _translation, methods) => <SwipePanel actions={startActions} side="start" testID={testID} methods={methods} onRun={run} /> : undefined
        }
        renderRightActions={
          endActions.length ? (_progress, _translation, methods) => <SwipePanel actions={endActions} side="end" testID={testID} methods={methods} onRun={run} /> : undefined
        }
        testID={`${testID}-swipeable`}>
        <View>
          {children(bind)}
          <View pointerEvents={keyFocus ? 'auto' : 'none'} style={[styles.keyMore, { opacity: keyFocus ? 1 : 0 }]}>
            <Pressable
              focusable
              accessibilityLabel={more.label}
              importantForAccessibility="no-hide-descendants"
              onFocus={() => setKeyFocus(true)}
              onBlur={() => setKeyFocus(false)}
              onPress={() => setSheet({})}
              style={[styles.keyMoreButton, { backgroundColor: colors.surface, borderColor: colors.focus }]}
              testID={`${testID}-more`}>
              <Icon name="more" size={20} color={colors.ink} />
            </Pressable>
          </View>
        </View>
      </ReanimatedSwipeable>
      {sheet ? <ActionSheet title={title} subtitle={subtitle} actions={actions} initial={sheet.initial} onClose={() => setSheet(null)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', alignItems: 'stretch' },
  panelEnd: { justifyContent: 'flex-end' },
  swipeButton: { width: 84, alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.xs },
  keyMore: { position: 'absolute', right: space.sm, top: 0, bottom: 0, justifyContent: 'center' },
  keyMoreButton: { width: 40, height: 40, borderRadius: radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
