export type Interruption = 'background' | 'call' | 'limit' | 'device' | 'restored';

export type VoiceState =
  | { phase: 'idle' }
  | { phase: 'pressing'; locked: boolean }
  | { phase: 'recording'; locked: boolean }
  | { phase: 'paused'; reason: Interruption | null }
  | { phase: 'cancelled' };

export type VoiceEvent =
  | { type: 'press' }
  | { type: 'start-locked' }
  | { type: 'live' }
  | { type: 'fail' }
  | { type: 'release' }
  | { type: 'lock' }
  | { type: 'pause'; reason?: Interruption }
  | { type: 'resume' }
  | { type: 'cancel' }
  | { type: 'undo' }
  | { type: 'done' };

export const idle: VoiceState = { phase: 'idle' };

export function voiceStep(state: VoiceState, event: VoiceEvent): VoiceState {
  switch (state.phase) {
    case 'idle':
      if (event.type === 'press') return { phase: 'pressing', locked: false };
      if (event.type === 'start-locked') return { phase: 'pressing', locked: true };
      if (event.type === 'pause' && event.reason === 'restored') return { phase: 'paused', reason: 'restored' };
      return state;
    case 'pressing':
      if (event.type === 'live') return { phase: 'recording', locked: state.locked };
      if (event.type === 'lock') return { phase: 'pressing', locked: true };
      if (event.type === 'fail' || event.type === 'cancel') return idle;
      if (event.type === 'release') return state.locked ? state : idle;
      return state;
    case 'recording':
      if (event.type === 'lock') return { phase: 'recording', locked: true };
      if (event.type === 'release') return state.locked ? state : idle;
      if (event.type === 'pause') return { phase: 'paused', reason: event.reason ?? null };
      if (event.type === 'cancel') return { phase: 'cancelled' };
      if (event.type === 'fail') return { phase: 'paused', reason: 'device' };
      if (event.type === 'done') return idle;
      return state;
    case 'paused':
      if (event.type === 'resume') return { phase: 'pressing', locked: true };
      if (event.type === 'cancel') return { phase: 'cancelled' };
      if (event.type === 'done') return idle;
      return state;
    case 'cancelled':
      if (event.type === 'undo') return { phase: 'paused', reason: null };
      if (event.type === 'done') return idle;
      return state;
  }
}

export function isActive(state: VoiceState): boolean {
  return state.phase !== 'idle';
}

export function isHeld(state: VoiceState): boolean {
  return (state.phase === 'pressing' || state.phase === 'recording') && !state.locked;
}
