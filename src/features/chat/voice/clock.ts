import { useSyncExternalStore } from 'react';

export const voiceLimitMs = 30 * 60 * 1000;
export const voiceWarnMs = 29 * 60 * 1000;

export type VoiceClock = { durationMs: number; live: boolean; version: number };

export class ClockStore {
  private recorded: number[] = [];
  private snapshot: VoiceClock = { durationMs: 0, live: false, version: 0 };
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  get = () => this.snapshot;
  get levels(): number[] {
    return this.recorded;
  }
  push(level: number) {
    this.recorded.push(level);
  }
  restore(levels: number[], durationMs: number) {
    this.recorded = [...levels];
    this.set(durationMs, false);
  }
  set(durationMs: number, live: boolean) {
    this.snapshot = { durationMs, live, version: this.snapshot.version + 1 };
    this.listeners.forEach((listener) => listener());
  }
}

export function useVoiceClock(clock: ClockStore): VoiceClock {
  return useSyncExternalStore(clock.subscribe, clock.get);
}
