import { Platform } from 'react-native';

export type PipSize = { width: number; height: number };

export function iosPip(size: PipSize | null | undefined) {
  if (Platform.OS !== 'ios' || !size) return undefined;
  return { enabled: true, startAutomatically: true, stopAutomatically: true, preferredSize: size };
}
