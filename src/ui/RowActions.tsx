import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type AccessibilityActionEvent, type AccessibilityActionInfo } from 'react-native';
import { Pressable } from './Pressable';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { radius, space, useTheme } from '../theme';
import { ActionSheet, type SheetAction } from './ActionSheet';
import { Icon } from './icons';
import { swipeStart, swipeVerdict } from './swipeIntent';
import { Text } from './Text';

export type RowBind = {
  onLongPress: () => void;
  delayLongPress: number;
  accessibilityActions: AccessibilityActionInfo[];
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
};

const moreKey = 'more';
const longPressMs = 420;
const swipeButtonWidth = 84;
const rowFriction = 1.6;
const rowOpenAt = 64;

export function swipeActionsFor(actions: SheetAction[], keys: string[], more: SheetAction): SheetAction[] {
  const byKey = new Map(actions.map((action) => [action.key, action]));
  return keys.flatMap((key) => (key === moreKey ? [more] : byKey.has(key) ? [byKey.get(key) as SheetAction] : []));
}

export function accessibilityActionsFor(actions: SheetAction[], moreLabel: string): AccessibilityActionInfo[] {
  return [{ name: 'longpress', label: moreLabel }, ...actions.map((action) => ({ name: action.key, label: action.label }))];
}

function useSidewaysGate(swipeEnabled: SharedValue<boolean>) {
  const origin = useSharedValue({ x: 0, y: 0, decided: false });
  return usePanGesture({
    manualActivation: true,
    onTouchesDown: (event) => {
      'worklet';
      const touch = event.changedTouches[0];
      if (touch) origin.set({ x: touch.absoluteX, y: touch.absoluteY, decided: false });
    },
    onTouchesMove: (event) => {
      'worklet';
      const start = origin.get();
      const touch = event.allTouches[0];
      if (start.decided || !touch) return;
      const verdict = swipeVerdict(touch.absoluteX - start.x, touch.absoluteY - start.y);
      if (verdict === 'undecided') return;
      origin.set({ ...start, decided: true });
      if (verdict === 'scroll') swipeEnabled.set(false);
    },
    onFinalize: () => {
      'worklet';
      swipeEnabled.set(true);
    },
  });
}

function SwipePanel({
  actions,
  side,
  testID,
  methods,
  armed,
  onRun,
}: {
  actions: SheetAction[];
  side: 'start' | 'end';
  testID: string;
  methods: SwipeableMethods;
  armed: boolean;
  onRun: (action: SheetAction) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.panel, side === 'end' && styles.panelEnd, { width: swipeButtonWidth * actions.length }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      testID={`${testID}-swipe-${side}`}>
      {armed && actions.map((action) => {
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
  const swipe = useRef<SwipeableMethods>(null);
  const swipeEnabled = useSharedValue(true);
  const sideways = useSidewaysGate(swipeEnabled);
  const [opened, setSheetFor] = useState<{ row: string; initial?: string } | null>(null);
  const [focusedRow, setFocusedRow] = useState<string | null>(null);
  const [armedRow, setArmedRow] = useState<string | null>(null);
  const sheet = opened?.row === testID ? opened : null;
  const keyFocus = focusedRow === testID;
  const armed = armedRow === testID;
  useEffect(() => {
    swipe.current?.reset();
  }, [testID]);
  const setSheet = (next: { initial?: string } | null) => setSheetFor(next ? { row: testID, ...next } : null);
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
      <GestureDetector gesture={sideways}>
      <View collapsable={false}>
      <ReanimatedSwipeable
        ref={swipe}
        enabled={swipeEnabled}
        onSwipeableOpenStartDrag={() => setArmedRow(testID)}
        friction={rowFriction}
        dragOffsetFromLeft={swipeStart}
        dragOffsetFromRight={-swipeStart}
        leftThreshold={rowOpenAt}
        rightThreshold={rowOpenAt}
        overshootLeft={false}
        overshootRight={false}
        renderLeftActions={
          startActions.length ? (_progress, _translation, methods) => <SwipePanel actions={startActions} side="start" testID={testID} methods={methods} armed={armed} onRun={run} /> : undefined
        }
        renderRightActions={
          endActions.length ? (_progress, _translation, methods) => <SwipePanel actions={endActions} side="end" testID={testID} methods={methods} armed={armed} onRun={run} /> : undefined
        }
        testID={`${testID}-swipeable`}>
        <View>
          {children(bind)}
          <View pointerEvents={keyFocus ? 'auto' : 'none'} style={[styles.keyMore, { opacity: keyFocus ? 1 : 0 }]}>
            <Pressable
              focusable
              accessibilityLabel={more.label}
              importantForAccessibility="no-hide-descendants"
              onFocus={() => setFocusedRow(testID)}
              onBlur={() => setFocusedRow(null)}
              onPress={() => setSheet({})}
              style={[styles.keyMoreButton, { backgroundColor: colors.surface, borderColor: colors.focus }]}
              testID={`${testID}-more`}>
              {keyFocus ? <Icon name="more" size={20} color={colors.ink} /> : null}
            </Pressable>
          </View>
        </View>
      </ReanimatedSwipeable>
      </View>
      </GestureDetector>
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
