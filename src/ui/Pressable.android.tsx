import type { ComponentProps } from 'react';
import { Pressable as NativePressable, StyleSheet, type ViewStyle } from 'react-native';
import { colorsFor } from '../theme/tokens';
import { useTheme } from '../theme';

type Props = ComponentProps<typeof NativePressable>;

const lightInk = colorsFor('light').ink;
const darkInk = colorsFor('dark').ink;

function luminance(hex: string): number | null {
  const match = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex);
  if (!match || (match[2] && parseInt(match[2], 16) < 128)) return null;
  const [r, g, b] = [0, 2, 4].map((at) => {
    const channel = parseInt(match[1].slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function stateLayerInk(container: unknown, fallback: string): string {
  const light = typeof container === 'string' ? luminance(container) : null;
  if (light === null) return fallback;
  return light < 0.18 ? darkInk : lightInk;
}

const clipped = { overflow: 'hidden' } as const;

function rounded(style: Readonly<Partial<ViewStyle>> | null | undefined): boolean {
  if (!style) return false;
  return Object.entries(style).some(([key, value]) => /^border\w*Radius$/.test(key) && (typeof value === 'number' ? value > 0 : typeof value === 'string'));
}

export function Pressable({ style, ...props }: Props) {
  const { material } = useTheme();
  if (props.android_ripple !== undefined) return <NativePressable style={style} {...props} />;
  const resting = StyleSheet.flatten(typeof style === 'function' ? style({ pressed: false }) : style);
  const ink = stateLayerInk(resting?.backgroundColor, material.onSurface);
  const color = `${ink}1A`;
  if (!rounded(resting)) {
    const unpressed: Props['style'] = typeof style === 'function' ? (state) => style({ ...state, pressed: false }) : style;
    return <NativePressable android_ripple={{ color }} style={unpressed} {...props} />;
  }
  const shaped: Props['style'] = typeof style === 'function' ? (state) => [style({ ...state, pressed: false }), clipped] : [style, clipped];
  return <NativePressable android_ripple={{ color, foreground: true }} style={shaped} {...props} />;
}
