import { GlassView } from 'expo-glass-effect';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import { radius, useTheme, type Scheme } from '../theme';
import { GlassBlur } from './GlassBlur';
import { useSeeThrough, useSurface } from './glass';
import { glassMaterial, type Thickness } from './glassMaterial';

type Props = ViewProps & { solid: StyleProp<ViewStyle>; tone?: Scheme; thickness?: Thickness; overMedia?: boolean; liquid?: boolean };

export function GlassCapsule({ solid, tone, thickness = 'regular', overMedia, liquid = false, style, children, ...props }: Props) {
  const { scheme } = useTheme();
  const surface = useSurface();
  const seeThrough = useSeeThrough();
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
  return (
    <View style={[style, { borderColor: glass.edge, borderWidth: 1, boxShadow: glass.shadow }]} {...props}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: corner, overflow: 'hidden' }]} testID="glass-backdrop">
        <GlassBlur tint={glass.blur} />
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
