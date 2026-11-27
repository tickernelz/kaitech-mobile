import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { readableWidth } from '../layout/windowClass';
import { space, useTheme } from '../theme';

const shortWindow = 480;

export function Screen({
  children,
  footer,
  scroll = false,
  edges = ['top', 'bottom'],
  testID,
  contentStyle,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  testID?: string;
  contentStyle?: ViewStyle;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const footerInside = scroll && height < shortWindow;
  const footerView = footer ? <View style={[styles.footer, footerInside && styles.footerInside]}>{footer}</View> : null;
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, styles.scrolled, contentStyle]} keyboardShouldPersistTaps="handled">
      {children}
      {footerInside ? footerView : null}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.canvas }]} testID={testID}>
      <KeyboardAvoidingView style={styles.fill} behavior="padding" automaticOffset>
        {body}
        {footerInside ? null : footerView}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrolled: { flexGrow: 1, paddingBottom: space.lg },
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.lg, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  footerInside: { paddingHorizontal: 0, paddingBottom: 0, marginTop: 'auto' },
});
