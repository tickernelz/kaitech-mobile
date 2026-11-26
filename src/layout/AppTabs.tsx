import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { GlassTabs } from './GlassTabs';
import { PillTabs } from './PillTabs';

export function AppTabs() {
  return isLiquidGlassAvailable() ? <GlassTabs /> : <PillTabs />;
}
