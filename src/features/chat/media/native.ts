import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeMedia = {
  renderPdfPage(source: string, page: number, width: number, target: string): Promise<{ width: number; height: number; pages: number }>;
  videoFrame(source: string, headers: Record<string, string>, width: number, target: string): Promise<{ width: number; height: number; durationMs: number }>;
};

let held: NativeMedia | null | undefined;

export function nativeMedia(): NativeMedia | null {
  if (held === undefined) held = requireOptionalNativeModule<NativeMedia>('KaitechMedia');
  return held;
}
