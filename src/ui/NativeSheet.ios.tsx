import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { FormSheet } from 'react-native-screens/experimental';
import { space } from '../theme';

type Presentation = { open: boolean; onDismiss: () => void; onNativeDismiss: () => void };

export function useSheetPresentation(onClose: () => void): { native: boolean; close: (then?: () => void) => void; presentation: Presentation } {
  const native = isLiquidGlassAvailable();
  const [closing, setClosing] = useState<{ then: () => void } | null>(null);
  const close = (then: () => void = onClose) => {
    if (native) setClosing({ then });
    else then();
  };
  return { native, close, presentation: { open: !closing, onDismiss: closing?.then ?? onClose, onNativeDismiss: onClose } };
}

export function NativeSheet({ presentation, children, testID }: { presentation: Presentation; children: ReactNode; testID?: string }) {
  const { height } = useWindowDimensions();
  return (
    <FormSheet
      isOpen={presentation.open}
      detents="fitToContents"
      prefersGrabberVisible
      onDismiss={presentation.onDismiss}
      onNativeDismiss={presentation.onNativeDismiss}>
      <View accessibilityViewIsModal style={[styles.content, { maxHeight: height * 0.88 }]} testID={testID}>
        {children}
      </View>
    </FormSheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: space.xl, paddingBottom: space.lg },
});
