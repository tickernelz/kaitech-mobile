import { requireOptionalNativeModule } from 'expo';
import { findNodeHandle, NativeModules, Platform } from 'react-native';

type Broadcast = {
  available(): boolean;
  addListener(name: 'onBroadcast', listener: (event: { state: string }) => void): { remove(): void };
};
type PickerManager = { show(tag: number): void };

const startTimeoutMs = 60_000;

let picker: unknown = null;
let module: Broadcast | null | undefined;

function broadcast(): Broadcast | null {
  if (module !== undefined) return module;
  module = Platform.OS === 'ios' ? requireOptionalNativeModule<Broadcast>('KaitechBroadcast') : null;
  return module;
}

export function setBroadcastPicker(view: unknown) {
  picker = view;
}

export function screenShareSupported(): boolean {
  if (Platform.OS === 'android') return true;
  if (Platform.OS === 'ios') return Boolean(broadcast()?.available());
  return false;
}

export function pickBroadcast(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(true);
  const native = broadcast();
  const manager = NativeModules.LKRNScreenCapturePickerViewManager as PickerManager | undefined;
  const tag = picker ? findNodeHandle(picker as never) : null;
  if (!native || !manager || tag == null) return Promise.resolve(false);
  return new Promise((resolve) => {
    const done = (started: boolean) => {
      clearTimeout(timer);
      subscription.remove();
      resolve(started);
    };
    const subscription = native.addListener('onBroadcast', (event) => {
      if (event.state === 'started') done(true);
    });
    const timer = setTimeout(() => done(false), startTimeoutMs);
    manager.show(tag);
  });
}
