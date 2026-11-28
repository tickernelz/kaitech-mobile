import { useCallback, useMemo, useRef, useState } from 'react';
import { findNodeHandle, RefreshControl, type LayoutChangeEvent, type RefreshControlProps } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useTheme } from '../theme';

const indicatorDiameter = 40;
const indicatorClearance = 8;

export const refreshIndicatorOffset = indicatorDiameter + indicatorClearance;

const releaseAttempts = 10;

type NativeRefresh = { releaseIndicatorTouches(tag: number): Promise<void> };

const native = requireOptionalNativeModule<NativeRefresh>('KaitechRefresh');

type RefreshProps = Omit<RefreshControlProps, 'refreshing' | 'onRefresh'> & { onRefresh: () => Promise<unknown> };

export function Refresh({ onLayout, onRefresh, ...props }: RefreshProps) {
  const { colors } = useTheme();
  const tint = useMemo(() => [colors.primary], [colors.primary]);
  const [pulled, setPulled] = useState(false);
  const pull = useCallback(() => {
    setPulled(true);
    const settle = () => setPulled(false);
    onRefresh().then(settle, settle);
  }, [onRefresh]);
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
  return (
    <RefreshControl
      progressViewOffset={refreshIndicatorOffset}
      tintColor={colors.primary}
      colors={tint}
      {...props}
      refreshing={pulled}
      onRefresh={pull}
      onLayout={release}
    />
  );
}
