import { EventEmitter, requireOptionalNativeModule } from 'expo';
import type { AudioRoute } from './proximity';

type NativeProximity = {
  audioRoute(): AudioRoute;
  setScreenOff(enabled: boolean): Promise<boolean>;
};

let held: NativeProximity | null | undefined;
let emitter: InstanceType<typeof EventEmitter> | null = null;

export function proximityNative(): NativeProximity | null {
  if (held !== undefined) return held;
  try {
    held = requireOptionalNativeModule<NativeProximity>('KaitechProximity');
  } catch {
    held = null;
  }
  try {
    emitter = held ? new EventEmitter(held as never) : null;
  } catch {
    emitter = null;
  }
  return held;
}

export function onAudioRouteChange(listener: () => void): () => void {
  proximityNative();
  if (!emitter) return () => undefined;
  const subscription = emitter.addListener('onAudioRouteChange', listener);
  return () => subscription.remove();
}
