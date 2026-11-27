import { BlurView } from 'expo-blur';
import { GlassView } from 'expo-glass-effect';
import { createContext, useContext, type ComponentRef, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { radius, useTheme, type Scheme } from '../theme';
import { useSeeThrough, useSurface } from './glass';
import { glassMaterial, type Thickness } from './glassMaterial';

export const BlurTarget = createContext<RefObject<ComponentRef<typeof View> | null> | null>(null);

type Props = ViewProps & { solid: StyleProp<ViewStyle>; tone?: Scheme; thickness?: Thickness; overMedia?: boolean; liquid?: boolean };

export function GlassCapsule({ solid, tone, thickness = 'regular', overMedia, liquid = false, style, children, ...props }: Props) {
  const { scheme } = useTheme();
  const surface = useSurface();
  const seeThrough = useSeeThrough();
  const target = useContext(BlurTarget);
  if (liquid && surface === 'glass') {
    return (
      <GlassView glassEffectStyle={overMedia ? 'clear' : 'regular'} style={style} {...props}>
        {children}
      </GlassView>
    );
  }
  if (!seeThrough) {
    return (
      <View style={[style, solid]} {...props}>
        {children}
      </View>
    );
  }
  const glass = glassMaterial(tone ?? scheme, thickness);
  const corner = StyleSheet.flatten(style)?.borderRadius ?? radius.pill;
  const ios = Platform.OS === 'ios';
  return (
    <View style={[style, { borderColor: glass.edge, borderWidth: 1, boxShadow: glass.shadow }]} {...props}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: corner, overflow: 'hidden' }]} testID="glass-backdrop">
        {ios || target ? (
          <BlurView
            tint={ios ? glass.blur : (tone ?? scheme)}
            intensity={ios ? 60 : 20}
            blurReductionFactor={1}
            blurMethod="dimezisBlurViewSdk31Plus"
            blurTarget={target ?? undefined}
            style={StyleSheet.absoluteFill}
            testID="glass-blur"
          />
        ) : null}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: glass.tint }]} testID="glass-tint" />
        <View style={[StyleSheet.absoluteFill, styles.sheen, { borderRadius: corner, borderTopColor: glass.sheen }]} />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sheen: { borderTopWidth: 1, borderColor: 'transparent' },
});
