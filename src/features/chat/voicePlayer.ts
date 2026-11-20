import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { meetingRecording } from '../../audio/meeting';
import { useSyncExternalStore } from 'react';

export type VoiceState = { id: string | null; playing: boolean; position: number; duration: number; rate: number; loading: boolean };

let state: VoiceState = { id: null, playing: false, position: 0, duration: 0, rate: 1, loading: false };
const listeners = new Set<() => void>();
let player: AudioPlayer | null = null;
let subscription: { remove(): void } | null = null;
let startWhenLoaded = false;
const rates = [1, 1.5, 2];

function set(next: Partial<VoiceState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function onStatus(status: AudioStatus) {
  if (startWhenLoaded && status.isLoaded) {
    startWhenLoaded = false;
    if (!status.playing) player?.play();
  }
  const duration = status.duration * 1000 || state.duration;
  const position = status.currentTime * 1000;
  if (status.didJustFinish) {
    set({ playing: false, position: 0, duration, loading: false });
    player?.pause();
    void player?.seekTo(0);
    return;
  }
  set({ playing: status.playing, position, duration, loading: status.isBuffering && !status.playing });
}

export function useVoice(): VoiceState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export async function toggleVoice(id: string, uri: string, headers?: Record<string, string>) {
  if (state.id === id && player) {
    startWhenLoaded = false;
    if (state.playing) player.pause();
    else player.play();
    return;
  }
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: meetingRecording() });
  subscription?.remove();
  player?.remove();
  player = createAudioPlayer({ uri, headers }, { updateInterval: 250 });
  player.setPlaybackRate(state.rate);
  subscription = player.addListener('playbackStatusUpdate', onStatus);
  set({ id, playing: false, position: 0, duration: 0, loading: true });
  startWhenLoaded = true;
  player.play();
}

export function cycleVoiceRate() {
  const next = rates[(rates.indexOf(state.rate) + 1) % rates.length];
  player?.setPlaybackRate(next);
  set({ rate: next });
}

export function stopVoice() {
  player?.pause();
  set({ playing: false });
}
