import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { GlassTabs } from './GlassTabs';
import { JsTabs } from './JsTabs';

export function AppTabs() {
  return isLiquidGlassAvailable() ? <GlassTabs /> : <JsTabs />;
}
