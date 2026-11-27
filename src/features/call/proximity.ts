import type { CallPhase } from './call';

export type AudioRoute = 'earpiece' | 'speaker' | 'bluetooth' | 'headset' | 'other' | 'unknown';

export type ProximityInput = {
  phase: CallPhase;
  cameraOn: boolean;
  screenSharing: boolean;
  people: { cameraOn: boolean; screenOn: boolean }[];
  speaker: boolean;
  route: AudioRoute;
  onCallScreen: boolean;
  inApp: boolean;
  pictureInPicture: boolean;
};

export function screenOffNearEar(input: ProximityInput): boolean {
  if (input.phase !== 'active' && input.phase !== 'reconnecting') return false;
  if (!input.onCallScreen || !input.inApp || input.pictureInPicture) return false;
  if (input.cameraOn || input.screenSharing) return false;
  if (input.people.some((person) => person.cameraOn || person.screenOn)) return false;
  return !input.speaker && input.route === 'earpiece';
}
