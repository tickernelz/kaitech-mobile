import { useWindowDimensions } from 'react-native';

export type WindowClass = 'compact' | 'medium' | 'expanded';

export const readableWidth = 720;
export const listPaneWidth = 360;
export const compactHeight = 480;
export const largeFontScale = 1.5;

export function windowClassFor(width: number): WindowClass {
  if (width < 600) return 'compact';
  if (width < 840) return 'medium';
  return 'expanded';
}

export function useWindowClass(): { windowClass: WindowClass; width: number; height: number; landscape: boolean; short: boolean } {
  const { width, height } = useWindowDimensions();
  return { windowClass: windowClassFor(width), width, height, landscape: width > height, short: height < compactHeight };
}

export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= largeFontScale;
}
