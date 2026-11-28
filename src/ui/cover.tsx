import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

let open = 0;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const covered = () => open > 0;

const change = (by: number) => {
  open += by;
  listeners.forEach((listener) => listener());
};

export function useCoverWhile(active: boolean) {
  useEffect(() => {
    if (!active) return;
    change(1);
    return () => change(-1);
  }, [active]);
}

export function useCovered() {
  return useSyncExternalStore(subscribe, covered);
}

export const hideWhen = (hidden: boolean) => (hidden ? 'no-hide-descendants' : 'auto');

export function Behind({ style, pointerEvents, testID, children }: { style?: StyleProp<ViewStyle>; pointerEvents?: ViewProps['pointerEvents']; testID?: string; children?: ReactNode }) {
  const hidden = useCovered();
  return (
    <View collapsable={false} style={style} pointerEvents={pointerEvents} importantForAccessibility={hideWhen(hidden)} testID={testID}>
      {children}
    </View>
  );
}
