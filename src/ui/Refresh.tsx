import { useCallback, useMemo, useRef } from 'react';
import { findNodeHandle, RefreshControl, type RefreshControlProps } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { useTheme } from '../theme';

const indicatorDiameter = 40;
const indicatorClearance = 8;

export const refreshIndicatorOffset = indicatorDiameter + indicatorClearance;

type NativeRefresh = { releaseIndicatorTouches(tag: number): Promise<void> };

const native = requireOptionalNativeModule<NativeRefresh>('KaitechRefresh');

export function Refresh(props: RefreshControlProps) {
  const { colors } = useTheme();
  const tint = useMemo(() => [colors.primary], [colors.primary]);
  const control = useRef<RefreshControl>(null);
  const released = useRef<number | null>(null);
  const release = useCallback(() => {
    const tag = control.current ? findNodeHandle(control.current) : null;
    if (!native || tag == null || tag === released.current) return;
    released.current = tag;
    native.releaseIndicatorTouches(tag).catch(() => {
      released.current = null;
    });
  }, []);
  return <RefreshControl ref={control} progressViewOffset={refreshIndicatorOffset} tintColor={colors.primary} colors={tint} {...props} onLayout={release} />;
}
