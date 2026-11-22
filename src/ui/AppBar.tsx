import type { ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export const largeTitleOwnsActions = true;

export function useCollapsingTitle(): { collapsed: boolean; onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void } {
  return { collapsed: false };
}

export function TopAppBar(_: { title: string; collapsed: boolean; navigation?: ReactNode; actions?: ReactNode }) {
  return null;
}
