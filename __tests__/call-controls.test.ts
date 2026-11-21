import { controlsFor, pillLimit, type ControlInput } from '../src/features/call/controls';

const base: ControlInput = { phase: 'active', video: true, cameraOn: true, sharing: false, share: true, record: true, pip: true, wide: false };

describe('call controls', () => {
  it.each([
    ['video', base],
    ['video, camera off', { ...base, cameraOn: false }],
    ['voice', { ...base, video: false }],
    ['sharing', { ...base, sharing: true }],
    ['connecting', { ...base, phase: 'connecting' as const, share: false, record: false }],
  ])('%s keeps the phone pill within the limit, with the microphone and the hang-up last', (_, input) => {
    const { pill, more } = controlsFor(input);
    expect(pill.length).toBeLessThanOrEqual(pillLimit.phone);
    expect(pill).toContain('mute');
    expect(pill[pill.length - 1]).toBe('hangup');
    expect(more.filter((action) => pill.includes(action))).toEqual([]);
  });

  it('puts the camera flip only next to a live camera', () => {
    expect(controlsFor(base).pill).toContain('flip');
    expect(controlsFor({ ...base, cameraOn: false }).pill).not.toContain('flip');
  });

  it('keeps stop sharing on the pill while sharing', () => {
    const { pill, more } = controlsFor({ ...base, sharing: true });
    expect(pill[0]).toBe('share');
    expect(more).not.toContain('share');
  });

  it('moves participants onto the pill on a wide screen', () => {
    const { pill, more } = controlsFor({ ...base, wide: true });
    expect(pill.length).toBeLessThanOrEqual(pillLimit.wide);
    expect(pill).toContain('people');
    expect(more).not.toContain('people');
  });

  it('offers only close once the call ended', () => {
    expect(controlsFor({ ...base, phase: 'ended' })).toEqual({ pill: ['close'], more: [] });
  });
});
