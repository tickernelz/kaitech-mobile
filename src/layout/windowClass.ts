import { useWindowDimensions } from 'react-native';

export type WindowClass = 'compact' | 'medium' | 'expanded';

export const readableWidth = 720;
export const listPaneWidth = 360;

export function windowClassFor(width: number): WindowClass {
  if (width < 600) return 'compact';
  if (width < 840) return 'medium';
  return 'expanded';
}

export function useWindowClass(): { windowClass: WindowClass; width: number; height: number; landscape: boolean } {
  const { width, height } = useWindowDimensions();
  return { windowClass: windowClassFor(width), width, height, landscape: width > height };
}
