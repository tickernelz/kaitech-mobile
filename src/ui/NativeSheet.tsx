import type { ReactNode } from 'react';

type Presentation = Record<string, never>;

export function useSheetPresentation(onClose: () => void): { native: boolean; close: (then?: () => void) => void; presentation: Presentation } {
  return { native: false, close: (then = onClose) => then(), presentation: {} };
}

export function NativeSheet({ children }: { presentation: Presentation; children: ReactNode; testID?: string }) {
  return children;
}
