import { ModalBottomSheet, RNHostView, type ModalBottomSheetRef } from '@expo/ui/jetpack-compose';
import { useCallback, useRef, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { space, useTheme } from '../theme';
import { MaterialHost } from './MaterialHost';

type Presentation = { attach: (sheet: ModalBottomSheetRef | null) => void; onDismiss: () => void };

export function useSheetPresentation(onClose: () => void): { native: boolean; close: (then?: () => void) => void; presentation: Presentation } {
  const sheet = useRef<ModalBottomSheetRef | null>(null);
  const closing = useRef(false);
  const attach = useCallback((handle: ModalBottomSheetRef | null) => {
    sheet.current = handle;
  }, []);
  const close = (then: () => void = onClose) => {
    if (closing.current) return;
    closing.current = true;
    const hidden = sheet.current?.hide() ?? Promise.resolve();
    hidden.then(then, then);
  };
  const onDismiss = () => {
    if (closing.current) return;
    closing.current = true;
    onClose();
  };
  return { native: true, close, presentation: { attach, onDismiss } };
}

export function NativeSheet({ presentation: { attach, onDismiss }, children, testID }: { presentation: Presentation; children: ReactNode; testID?: string }) {
  const { colors, material } = useTheme();
  const { height } = useWindowDimensions();
  return (
    <MaterialHost matchContents style={styles.host}>
      <ModalBottomSheet ref={attach} onDismissRequest={onDismiss} skipPartiallyExpanded containerColor={material.surfaceContainerLow} scrimColor={colors.scrim} showDragHandle>
        <RNHostView matchContents={{ vertical: true }}>
          <View accessibilityViewIsModal style={[styles.content, { maxHeight: height * 0.88 }]} testID={testID}>
            {children}
          </View>
        </RNHostView>
      </ModalBottomSheet>
    </MaterialHost>
  );
}

const styles = StyleSheet.create({
  host: { position: 'absolute' },
  content: { paddingBottom: space.lg },
});
