import { useCallback, useMemo, useRef } from 'react';
import { findNodeHandle, RefreshControl, type LayoutChangeEvent, type RefreshControlProps } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useTheme } from '../theme';

const indicatorDiameter = 40;
const indicatorClearance = 8;

export const refreshIndicatorOffset = indicatorDiameter + indicatorClearance;

const releaseAttempts = 10;

type NativeRefresh = { releaseIndicatorTouches(tag: number): Promise<void> };

const native = requireOptionalNativeModule<NativeRefresh>('KaitechRefresh');

export function Refresh({ onLayout, ...props }: RefreshControlProps) {
  const { colors } = useTheme();
  const tint = useMemo(() => [colors.primary], [colors.primary]);
  const released = useRef<number | null>(null);
  const release = useCallback(
    (event: LayoutChangeEvent) => {
      onLayout?.(event);
      const tag = findNodeHandle(event.currentTarget) ?? (event.nativeEvent as { target?: unknown }).target;
      if (!native || typeof tag !== 'number' || tag === released.current) return;
      released.current = tag;
      const attempt = (left: number) => {
        native.releaseIndicatorTouches(tag).catch(() => {
          if (released.current !== tag) return;
          if (left > 0) requestAnimationFrame(() => attempt(left - 1));
          else released.current = null;
        });
      };
      attempt(releaseAttempts);
    },
    [onLayout],
  );
  return <RefreshControl progressViewOffset={refreshIndicatorOffset} tintColor={colors.primary} colors={tint} {...props} onLayout={release} />;
}
