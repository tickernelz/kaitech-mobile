import type { ComponentProps } from 'react';
import { Pressable as NativePressable } from 'react-native';
import { useTheme } from '../theme';

export function Pressable(props: ComponentProps<typeof NativePressable>) {
  const { material } = useTheme();
  if (props.android_ripple !== undefined) return <NativePressable {...props} />;
  return <NativePressable android_ripple={{ color: `${material.onSurface}1A` }} {...props} />;
}
