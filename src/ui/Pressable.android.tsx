import type { ComponentProps } from 'react';
import { Pressable as NativePressable } from 'react-native';
import { useTheme } from '../theme';

type Props = ComponentProps<typeof NativePressable>;

export function Pressable({ style, ...props }: Props) {
  const { material } = useTheme();
  if (props.android_ripple !== undefined) return <NativePressable style={style} {...props} />;
  const unpressed: Props['style'] = typeof style === 'function' ? (state) => style({ ...state, pressed: false }) : style;
  return <NativePressable android_ripple={{ color: `${material.onSurface}1A` }} style={unpressed} {...props} />;
}
