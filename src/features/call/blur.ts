import { requireOptionalNativeModule } from 'expo';
import Storage from 'expo-sqlite/kv-store';

type NativeEffects = { blurName(): string; clearBlur(): void; blurAvailable(): boolean };
export type EffectTrack = { _setVideoEffects?: (names: string[]) => void };

const key = 'call.backgroundBlur';

function effects(): NativeEffects | null {
  return requireOptionalNativeModule<NativeEffects>('KaitechVideoEffects');
}

export function blurSupported(): boolean {
  return effects()?.blurAvailable() === true;
}

export function blurPreferred(): boolean {
  return Storage.getItemSync(key) === '1';
}

export function setBlurPreferred(next: boolean) {
  Storage.setItemSync(key, next ? '1' : '0');
}

export function applyBlur(track: EffectTrack | undefined, on: boolean): boolean {
  const module = effects();
  if (!module || typeof track?._setVideoEffects !== 'function') return false;
  if (!on) module.clearBlur();
  track._setVideoEffects(on ? [module.blurName()] : []);
  return true;
}
