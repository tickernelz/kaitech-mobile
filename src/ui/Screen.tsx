import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { readableWidth } from '../layout/windowClass';
import { space, useTheme } from '../theme';

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
  const body = scroll ? (
    <ScrollView contentContainerStyle={[styles.content, styles.grow, contentStyle]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.canvas }]} testID={testID}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.lg, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.lg, gap: space.sm, width: '100%', maxWidth: readableWidth, alignSelf: 'center' },
});
