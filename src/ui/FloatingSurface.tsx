import { GlassView } from 'expo-glass-effect';
import { View, type ColorValue, type ViewProps } from 'react-native';
import { useSurface } from './glass';

export function FloatingSurface({ solid, overMedia, style, children, ...props }: ViewProps & { solid: ColorValue; overMedia?: boolean }) {
  const surface = useSurface();
  if (surface === 'glass') {
    return (
      <GlassView glassEffectStyle={overMedia ? 'clear' : 'regular'} style={style} {...props}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[style, { backgroundColor: solid }]} {...props}>
      {children}
    </View>
  );
}
