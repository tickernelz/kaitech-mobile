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

const fingertip = 24;

function rippleRadius(style: Readonly<Partial<ViewStyle>> | null | undefined): number | undefined {
  if (!style) return undefined;
  const rounded = Object.entries(style).some(([key, value]) => /^border\w*Radius$/.test(key) && (typeof value === 'number' ? value > 0 : typeof value === 'string'));
  if (!rounded) return undefined;
  const sides = [style.width, style.height].filter((side): side is number => typeof side === 'number');
  const across = sides.length ? Math.min(...sides) : typeof style.minHeight === 'number' ? style.minHeight : undefined;
  return across === undefined ? fingertip : across / 2;
}

export function Pressable({ style, ...props }: Props) {
  const { material } = useTheme();
  if (props.android_ripple !== undefined) return <NativePressable style={style} {...props} />;
  const resting = typeof style === 'function' ? style({ pressed: false }) : style;
  const flat = StyleSheet.flatten(resting);
  const ink = stateLayerInk(flat?.backgroundColor, material.onSurface);
  const radius = rippleRadius(flat);
  const unpressed: Props['style'] = typeof style === 'function' ? (state) => style({ ...state, pressed: false }) : style;
  return <NativePressable android_ripple={radius === undefined ? { color: `${ink}1A` } : { color: `${ink}1A`, radius }} style={unpressed} {...props} />;
}
