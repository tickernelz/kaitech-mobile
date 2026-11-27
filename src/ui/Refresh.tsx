import { useCallback, useMemo, useRef } from 'react';
import { findNodeHandle, RefreshControl, type LayoutChangeEvent, type RefreshControlProps } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useTheme } from '../theme';

const indicatorDiameter = 40;
const indicatorClearance = 8;

export const refreshIndicatorOffset = indicatorDiameter + indicatorClearance;

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
      native.releaseIndicatorTouches(tag).catch(() => {
        released.current = null;
      });
    },
    [onLayout],
  );
  return <RefreshControl progressViewOffset={refreshIndicatorOffset} tintColor={colors.primary} colors={tint} {...props} onLayout={release} />;
}
