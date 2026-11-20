import { EventEmitter, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type CallAction = {
  type: 'incoming' | 'cancel' | 'answer' | 'open' | 'decline' | 'hangup';
  channelId?: number;
  callId?: number;
  video?: boolean;
  title?: string;
  body?: string;
  caller?: string;
  db?: string;
  uid?: number;
  system?: boolean;
};

export type PictureInPicture = { video: boolean; title: string; body: string; channelId: number; muted: boolean; camera: boolean };

type NativeCall = {
  takePending(): Promise<CallAction[]>;
  takeLaunchAction(): Promise<CallAction | null>;
  ring(action: { title: string; body: string; channelId: number; callId: number; video: boolean; db: string; uid: number }): void;
  cancelRing(channelId: number): void;
  startCall(action: { video: boolean; title: string; body: string; channelId: number }): void;
  updateCall(action: PictureInPicture): void;
  stopCall(): void;
  setInCall(value: boolean): void;
  setLocked(value: boolean): void;
  enterPictureInPicture(): Promise<boolean>;
  isPictureInPictureSupported(): boolean;
  canUseFullScreenIntent(): boolean;
  openFullScreenIntentSettings(): Promise<void>;
};

let held: NativeCall | null | undefined;
let emitter: InstanceType<typeof EventEmitter> | null | undefined;

function load(): NativeCall | null {
  if (held !== undefined) return held;
  if (Platform.OS !== 'android') {
    held = null;
    return held;
  }
  try {
    held = requireOptionalNativeModule<NativeCall>('KaitechCall');
    emitter = held ? new EventEmitter(held as never) : null;
  } catch {
    held = null;
    emitter = null;
  }
  return held;
}

export function callNative(): NativeCall | null {
  return load();
}

export function onCallAction(listener: (action: CallAction) => void): () => void {
  load();
  if (!emitter) return () => undefined;
  const subscription = emitter.addListener('onCallAction', listener as (payload: unknown) => void);
  return () => subscription.remove();
}
