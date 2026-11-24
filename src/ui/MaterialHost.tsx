import type { HostProps } from '@expo/ui/jetpack-compose';
import { compose } from './compose';
import { seedColor, useTheme } from '../theme';

export function MaterialHost(props: Omit<HostProps, 'colorScheme' | 'seedColor' | 'colorOverrides'>) {
  const { scheme, material } = useTheme();
  const { Host } = compose();
  return <Host {...props} colorScheme={scheme} seedColor={seedColor} colorOverrides={material} />;
}
