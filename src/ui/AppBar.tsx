import type { ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export function useCollapsingTitle(): { collapsed: boolean; onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  return { collapsed: false };
}

export function CollapsedAppBar(_: { title: string; collapsed: boolean; actions?: ReactNode }) {
  return null;
}
