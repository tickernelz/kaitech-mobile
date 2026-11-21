import { EventEmitter, requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export type CallAction = {
  type: 'incoming' | 'cancel' | 'answer' | 'open' | 'decline' | 'hangup' | 'stopShare' | 'mute' | 'camera' | 'pip';
  active?: boolean;
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
  updateCall(video: boolean, title: string, body: string, channelId: number, muted: boolean, camera: boolean, sharing: boolean): Promise<boolean>;
  stopCall(): Promise<boolean>;
  setInCall(value: boolean): Promise<boolean>;
  setLocked(value: boolean): Promise<boolean>;
  readonly pictureInPictureSupported?: boolean;
  setCallSurface(visible: boolean): Promise<boolean>;
  isInPictureInPicture(): boolean;
  isResumed(): boolean;
  enterPictureInPicture(): Promise<boolean>;
  leavePictureInPicture(): Promise<boolean>;
  setPictureInPicture(enabled: boolean, width: number, height: number, muted: boolean, camera: boolean, video: boolean, sharing: boolean): Promise<boolean>;
  setPictureInPictureHint(x: number, y: number, width: number, height: number): Promise<boolean>;
  canUseFullScreenIntent(): Promise<boolean>;
  openFullScreenIntentSettings(): Promise<boolean>;
  setMessagesHidden(value: boolean): Promise<boolean>;
  setMessageLanguage(value: string): Promise<boolean>;
  setMutedConversations(db: string, uid: number, channelIds: number[], until: number[]): Promise<boolean>;
  setOpenConversations(db: string, uid: number, channelIds: number[]): Promise<boolean>;
  clearConversation(db: string, uid: number, channelId: number): Promise<boolean>;
  clearAccountMessages(db: string, uid: number): Promise<boolean>;
  messageResult(db: string, uid: number, channelId: number, sendKey: string, ok: boolean): Promise<boolean>;
  openBubbleSettings(db: string, uid: number, channelId: number): Promise<boolean>;
  takeMessageOpen(): Promise<MessageOpen | null>;
};

export type MessageOpen = { db: string; uid: number; channelId: number };

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

export function onMessageOpen(listener: () => void): () => void {
  load();
  if (!emitter) return () => undefined;
  const subscription = emitter.addListener('onMessageOpen', listener);
  return () => subscription.remove();
}

export function onCallAction(listener: (action: CallAction) => void): () => void {
  load();
  if (!emitter) return () => undefined;
  const subscription = emitter.addListener('onCallAction', listener as (payload: unknown) => void);
  return () => subscription.remove();
}
