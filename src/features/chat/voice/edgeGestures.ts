import { requireOptionalNativeModule } from 'expo';
import { findNodeHandle, Platform, type LayoutChangeEvent } from 'react-native';

type NativeVoice = { keepEdgeGestures?(tag: number): Promise<void> };

export function keepEdgeGestures(event: LayoutChangeEvent): void {
  if (Platform.OS !== 'android') return;
  const native = requireOptionalNativeModule<NativeVoice>('KaitechVoice');
  const tag = typeof event.target === 'number' ? event.target : findNodeHandle(event.target);
  if (!native?.keepEdgeGestures || tag == null) return;
  native.keepEdgeGestures(tag).catch(() => undefined);
}
