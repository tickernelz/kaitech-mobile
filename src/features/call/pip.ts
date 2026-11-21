import type { CallPerson, CallPhase } from './call';

export type PipFocus = { person: CallPerson; source: 'camera' | 'screen' };

export type PipSpec = { enabled: boolean; width: number; height: number; muted: boolean; camera: boolean; video: boolean; sharing: boolean };

type Dimensions = { width: number; height: number } | null;

const fallback = { width: 3, height: 4 };

export function pipFocus(people: CallPerson[], speaking: string[], previous: string | null): PipFocus | null {
  const remote = people.filter((person) => !person.local);
  const presenter = remote.find((person) => person.screenOn);
  if (presenter) return { person: presenter, source: 'screen' };
  const loudest = speaking.map((sid) => remote.find((person) => person.sid === sid)).find((person) => person !== undefined);
  const kept = remote.find((person) => person.sid === previous);
  const person = loudest ?? kept ?? remote.find((person) => person.cameraOn) ?? remote[0] ?? people.find((item) => item.local);
  return person ? { person, source: 'camera' } : null;
}

export function pipEligible(phase: CallPhase, video: boolean, people: CallPerson[]): boolean {
  if (phase !== 'active' && phase !== 'reconnecting') return false;
  return video || people.some((person) => !person.local && (person.cameraOn || person.screenOn));
}

export function pipSpec(input: {
  allowed: boolean;
  phase: CallPhase;
  video: boolean;
  muted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  people: CallPerson[];
  focus: PipFocus | null;
  dimensions: Dimensions;
}): PipSpec {
  const showsVideo = input.focus !== null && (input.focus.source === 'screen' || input.focus.person.cameraOn);
  const size = showsVideo && input.dimensions && input.dimensions.width > 0 && input.dimensions.height > 0 ? input.dimensions : fallback;
  return {
    enabled: input.allowed && pipEligible(input.phase, input.video, input.people),
    width: Math.round(size.width),
    height: Math.round(size.height),
    muted: input.muted,
    camera: input.cameraOn,
    video: input.video,
    sharing: input.screenSharing,
  };
}
