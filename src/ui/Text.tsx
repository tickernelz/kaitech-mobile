import { Text as NativeText, type TextProps } from 'react-native';
import { type as typography, useTheme, type Colors } from '../theme';

type Variant = keyof typeof typography;

export function Text({
  variant = 'body',
  tone = 'ink',
  style,
  ...props
}: TextProps & { variant?: Variant; tone?: keyof Colors }) {
  const { colors } = useTheme();
  return <NativeText {...props} style={[typography[variant], { color: colors[tone] }, style]} />;
}
