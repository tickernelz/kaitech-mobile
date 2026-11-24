import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { GlassTabs } from '../../layout/GlassTabs';
import { JsTabs } from '../../layout/JsTabs';

export default function TabsLayout() {
  return isLiquidGlassAvailable() ? <GlassTabs /> : <JsTabs />;
}
