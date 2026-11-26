import { base64Of, bucketsOf, levelOf, waveformOf } from '../src/features/chat/voice/levels';
import { idle, isHeld, voiceStep, type VoiceEvent, type VoiceState } from '../src/features/chat/voice/machine';

const run = (events: VoiceEvent['type'][], from: VoiceState = idle) => events.reduce((state, type) => voiceStep(state, { type } as VoiceEvent), from);

describe('voice state machine', () => {
  it('goes press, live, release back to idle', () => {
    expect(run(['press'])).toEqual({ phase: 'pressing', locked: false });
    expect(run(['press', 'live'])).toEqual({ phase: 'recording', locked: false });
    expect(run(['press', 'live', 'release'])).toEqual(idle);
  });

  it('drops a press that is released before the microphone is live', () => {
    expect(run(['press', 'release'])).toEqual(idle);
    expect(run(['press', 'fail'])).toEqual(idle);
  });

  it('stays recording after release once locked, then pauses, resumes locked and finishes', () => {
    const locked = run(['press', 'live', 'lock', 'release']);
    expect(locked).toEqual({ phase: 'recording', locked: true });
    expect(isHeld(locked)).toBe(false);
    const paused = voiceStep(locked, { type: 'pause' });
    expect(paused).toEqual({ phase: 'paused', reason: null });
    expect(run(['resume'], paused)).toEqual({ phase: 'pressing', locked: true });
    expect(run(['resume', 'live'], paused)).toEqual({ phase: 'recording', locked: true });
    expect(run(['done'], paused)).toEqual(idle);
  });

  it('locks while still waiting for the microphone', () => {
    expect(run(['press', 'lock', 'release', 'live'])).toEqual({ phase: 'recording', locked: true });
  });

  it('pauses with the interruption reason and turns a failure mid-recording into a pause', () => {
    const recording = run(['press', 'live']);
    expect(voiceStep(recording, { type: 'pause', reason: 'call' })).toEqual({ phase: 'paused', reason: 'call' });
    expect(voiceStep(recording, { type: 'fail' })).toEqual({ phase: 'paused', reason: 'device' });
  });

  it('cancels into an undoable state, and undo returns to paused', () => {
    const cancelled = run(['press', 'live', 'cancel']);
    expect(cancelled).toEqual({ phase: 'cancelled' });
    expect(run(['undo'], cancelled)).toEqual({ phase: 'paused', reason: null });
    expect(run(['done'], cancelled)).toEqual(idle);
  });

  it('ignores events that are not allowed in the current state', () => {
    expect(run(['release', 'live', 'lock', 'resume', 'undo', 'done'])).toEqual(idle);
    const paused: VoiceState = { phase: 'paused', reason: null };
    expect(run(['press', 'live', 'lock', 'release'], paused)).toBe(paused);
    expect(voiceStep(idle, { type: 'pause', reason: 'background' })).toBe(idle);
    expect(voiceStep(idle, { type: 'pause', reason: 'restored' })).toEqual({ phase: 'paused', reason: 'restored' });
  });
});

describe('voice levels', () => {
  it('maps dBFS to 0..1 with silence flat and full scale at 1', () => {
    expect(levelOf(-160)).toBe(0);
    expect(levelOf(-50)).toBe(0);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(undefined)).toBe(0);
    expect(levelOf(Number.NaN)).toBe(0);
    expect(levelOf(-25)).toBeCloseTo(0.5 ** 0.8, 5);
  });

  it('resamples to 64 values with the peak of each bucket, in 0..255', () => {
    const levels = Array.from({ length: 640 }, (_, index) => (index % 10 === 3 ? 1 : 0.1));
    const wave = waveformOf(levels);
    expect(wave).toHaveLength(64);
    expect(wave.every((value) => value === 255)).toBe(true);
    expect(waveformOf([0.5])).toHaveLength(64);
    expect(waveformOf([])).toEqual(new Array(64).fill(0));
    expect(waveformOf([2, -1]).every((value) => value >= 0 && value <= 255)).toBe(true);
    expect(bucketsOf([0.1, 0.9, 0.2, 0.3], 2)).toEqual([0.9, 0.3]);
  });

  it('encodes the 64 bytes as standard base64', () => {
    const wave = Array.from({ length: 64 }, (_, index) => (index * 37) % 256);
    expect(base64Of(wave)).toHaveLength(88);
    expect(base64Of([77, 97, 110])).toBe('TWFu');
    expect(base64Of([77, 97])).toBe('TWE=');
  });
});
