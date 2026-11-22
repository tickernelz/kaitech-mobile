import { createElement } from 'react';
import { View, type ViewProps } from 'react-native';

export const isLiquidGlassAvailable = jest.fn(() => false);
export const isGlassEffectAPIAvailable = jest.fn(() => false);

export function GlassView(props: ViewProps & { glassEffectStyle?: unknown; tintColor?: unknown; isInteractive?: boolean; colorScheme?: unknown }) {
  return createElement('ExpoGlassView', props);
}

export function GlassContainer({ spacing, ...props }: ViewProps & { spacing?: number }) {
  return <View {...props} />;
}
