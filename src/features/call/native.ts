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

export type RingCall = { title: string; body: string; channelId: number; callId: number; video: boolean; db: string; uid: number };
export type OngoingCall = { video: boolean; title: string; body: string; channelId: number; muted: boolean; camera: boolean };

type NativeCall = {
  takePending(): Promise<CallAction[]>;
  takeLaunchAction(): Promise<CallAction | null>;
  ring(title: string, body: string, channelId: number, callId: number, video: boolean, db: string, uid: number): Promise<boolean>;
  ringing(): Promise<boolean>;
  cancelRing(channelId: number): Promise<boolean>;
  startCall(video: boolean, title: string, body: string, channelId: number): Promise<boolean>;
  updateCall(video: boolean, title: string, body: string, channelId: number, muted: boolean, camera: boolean): Promise<boolean>;
  stopCall(): Promise<boolean>;
  setInCall(value: boolean): Promise<boolean>;
  setLocked(value: boolean): Promise<boolean>;
  enterPictureInPicture(): Promise<boolean>;
  isPictureInPictureSupported(): Promise<boolean>;
  canUseFullScreenIntent(): Promise<boolean>;
  openFullScreenIntentSettings(): Promise<boolean>;
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
