import { controlsFor, groupedMore, pillLimit, type ControlInput } from '../src/features/call/controls';

const base: ControlInput = { phase: 'active', video: true, cameraOn: true, sharing: false, share: true, record: true, pip: true, wide: false, invite: true, crowd: true };

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

  it('puts the web call actions in More, grouped by sound, video and people', () => {
    const { more } = controlsFor(base);
    expect(more).toEqual(expect.arrayContaining(['output', 'deafen', 'hand', 'spotlight', 'videoOnly', 'invite']));
    expect(groupedMore(more).map((entry) => [entry.group, entry.actions])).toEqual([
      ['sound', ['speaker', 'output', 'deafen']],
      ['video', ['share', 'record', 'spotlight', 'videoOnly', 'pip']],
      ['people', ['hand', 'invite', 'people']],
    ]);
  });

  it('offers background blur in the video group of More only for a video call on a phone that has the effect', () => {
    expect(groupedMore(controlsFor({ ...base, blur: true }).more).find((entry) => entry.group === 'video')?.actions[0]).toBe('blur');
    expect(controlsFor({ ...base, blur: true, video: false }).more).not.toContain('blur');
    expect(controlsFor(base).more).not.toContain('blur');
  });

  it('keeps invite out of a direct chat and the crowd views out of a two-person call', () => {
    const { more } = controlsFor({ ...base, invite: false, crowd: false });
    expect(more).not.toContain('invite');
    expect(more).not.toContain('spotlight');
    expect(more).not.toContain('videoOnly');
  });

  it('offers no in-call actions before the call connects', () => {
    const { more } = controlsFor({ ...base, phase: 'connecting' });
    expect(more.filter((action) => ['output', 'deafen', 'hand', 'invite'].includes(action))).toEqual([]);
  });

  it('offers only close once the call ended', () => {
    expect(controlsFor({ ...base, phase: 'ended' })).toEqual({ pill: ['close'], more: [] });
  });
});
