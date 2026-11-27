import { BlurView, type BlurTint } from 'expo-blur';
import { StyleSheet } from 'react-native';

export function GlassBlur({ tint }: { tint: BlurTint }) {
  return <BlurView tint={tint} intensity={60} style={StyleSheet.absoluteFill} testID="glass-blur" />;
}
