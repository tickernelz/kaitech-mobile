import { pipEligible, pipFocus, pipSpec } from '../src/features/call/pip';
import type { CallPerson } from '../src/features/call/call';

function person(sid: string, extra: Partial<CallPerson> = {}): CallPerson {
  return { sid, name: sid, partnerId: null, local: false, speaking: false, cameraOn: false, micOn: true, screenOn: false, hand: false, deaf: false, ...extra };
}

const me = person('me', { local: true, cameraOn: true });

describe('what the picture-in-picture window shows', () => {
  it('shows the remote presenter screen first', () => {
    const people = [me, person('a', { cameraOn: true }), person('b', { screenOn: true })];
    expect(pipFocus(people, ['a'], null)).toEqual({ person: people[2], source: 'screen' });
  });

  it('never shows your own shared screen, so the share does not mirror itself', () => {
    const people = [{ ...me, screenOn: true }, person('a', { cameraOn: true })];
    expect(pipFocus(people, [], null)).toEqual({ person: people[1], source: 'camera' });
    expect(pipFocus([{ ...me, screenOn: true }], [], null)).toEqual({ person: { ...me, screenOn: true }, source: 'camera' });
  });

  it('follows the active speaker in a group call and keeps them after they stop talking', () => {
    const people = [me, person('a', { cameraOn: true }), person('b'), person('c')];
    expect(pipFocus(people, ['me', 'c'], 'a')?.person.sid).toBe('c');
    expect(pipFocus(people, [], 'c')?.person.sid).toBe('c');
    expect(pipFocus(people, [], 'gone')?.person.sid).toBe('a');
  });
});

describe('when a call may go into picture-in-picture', () => {
  it('opens once anyone shows a camera, or someone else shares a screen', () => {
    const dark = { ...me, cameraOn: false };
    expect(pipEligible('active', [me])).toBe(true);
    expect(pipEligible('active', [dark, person('a')])).toBe(false);
    expect(pipEligible('active', [dark, person('a', { cameraOn: true })])).toBe(true);
    expect(pipEligible('active', [dark, person('a', { screenOn: true })])).toBe(true);
    expect(pipEligible('active', [{ ...dark, screenOn: true }, person('a')])).toBe(false);
    expect(pipEligible('ended', [me])).toBe(false);
    expect(pipEligible('outgoing', [me])).toBe(false);
  });

  it('takes the window shape from the video it shows and falls back to portrait for an avatar', () => {
    const base = { allowed: true, phase: 'active' as const, muted: false, cameraOn: true, screenSharing: false };
    const caller = person('a', { cameraOn: true });
    expect(pipSpec({ ...base, people: [me, caller], focus: { person: caller, source: 'camera' }, dimensions: { width: 1280, height: 720 } })).toMatchObject({ enabled: true, width: 1280, height: 720 });
    const dark = person('a');
    expect(pipSpec({ ...base, people: [me, dark], focus: { person: dark, source: 'camera' }, dimensions: { width: 1280, height: 720 } })).toMatchObject({ width: 3, height: 4 });
    expect(pipSpec({ ...base, allowed: false, people: [me, caller], focus: null, dimensions: null }).enabled).toBe(false);
  });
});
