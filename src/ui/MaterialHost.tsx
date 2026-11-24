import { Host, type HostProps } from '@expo/ui/jetpack-compose';
import { seedColor, useTheme } from '../theme';

export function MaterialHost(props: Omit<HostProps, 'colorScheme' | 'seedColor' | 'colorOverrides'>) {
  const { scheme, material } = useTheme();
  return <Host {...props} colorScheme={scheme} seedColor={seedColor} colorOverrides={material} />;
}
