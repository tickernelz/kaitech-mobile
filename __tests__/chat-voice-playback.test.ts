import type { Message } from '../src/features/chat/types';

const mockStore = new Map<string, string>();
const mockForgotten: ((id: string) => void)[] = [];
const mockSession = { activeId: 'acct-1' as string | null };
const mockPlayers: { rate: number; plays: number; seeks: number[]; listener: ((status: unknown) => void) | null }[] = [];

jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (key: string) => mockStore.get(key) ?? null,
    setItemSync: (key: string, value: string) => mockStore.set(key, value),
    removeItemSync: (key: string) => mockStore.delete(key),
  },
}));
jest.mock('../src/auth/session', () => ({ getSession: () => mockSession, onAccountForgotten: (listener: (id: string) => void) => mockForgotten.push(listener) }));
jest.mock('../src/audio/meeting', () => ({ meetingRecording: () => false }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(async () => undefined) }));
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => undefined),
  createAudioPlayer: () => {
    const made = {
      rate: 1,
      plays: 0,
      seeks: [] as number[],
      listener: null as ((status: unknown) => void) | null,
      setPlaybackRate(rate: number) {
        made.rate = rate;
      },
      addListener(_name: string, listener: (status: unknown) => void) {
        made.listener = listener;
        return { remove: () => undefined };
      },
      play() {
        made.plays++;
      },
      pause() {
        return undefined;
      },
      async seekTo(seconds: number) {
        made.seeks.push(seconds);
      },
      remove() {
        return undefined;
      },
      setActiveForLockScreen() {
        return undefined;
      },
    };
    mockPlayers.push(made);
    return made;
  },
}));

const player = require('../src/features/chat/voicePlayer') as typeof import('../src/features/chat/voicePlayer');
const { nextVoiceAfter } = require('../src/features/chat/voice/next') as typeof import('../src/features/chat/voice/next');

const status = (extra: Record<string, unknown>) => ({ isLoaded: true, playing: true, duration: 10, currentTime: 0, didJustFinish: false, isBuffering: false, ...extra });

function message(id: number, body: string, voice: boolean): Message {
  return {
    id,
    channelId: 1,
    authorId: 2,
    author: 'Rina',
    body,
    date: id,
    type: 'comment',
    parentId: null,
    reactions: [],
    attachments: voice ? [{ id: id * 10, name: 'voice.m4a', mimetype: 'audio/mp4', size: 1, voice: true, accessToken: null, checksum: null, url: null }] : [],
  };
}

beforeEach(() => {
  mockStore.clear();
  mockSession.activeId = 'acct-1';
  player.closeVoice();
});

describe('voice playback', () => {
  it('remembers the speed per account and forgets it with the account', async () => {
    await player.toggleVoice('a1', 'https://x/1');
    player.cycleVoiceRate();
    expect(player.voiceState().rate).toBe(1.5);
    expect(player.rateFor('acct-1')).toBe(1.5);
    expect(player.rateFor('acct-2')).toBe(1);
    await player.toggleVoice('a2', 'https://x/2');
    expect(mockPlayers[mockPlayers.length - 1].rate).toBe(1.5);
    mockForgotten.forEach((listener) => listener('acct-1'));
    expect(player.rateFor('acct-1')).toBe(1);
  });

  it('marks a voice message played when it starts, per account', async () => {
    expect(player.isPlayed('a7')).toBe(false);
    await player.toggleVoice('a7', 'https://x/7');
    expect(player.isPlayed('a7')).toBe(true);
    mockSession.activeId = 'acct-2';
    expect(player.isPlayed('a7')).toBe(false);
  });

  it('resumes a paused message from where it stopped', async () => {
    await player.toggleVoice('a1', 'https://x/1');
    mockPlayers[mockPlayers.length - 1].listener?.(status({ currentTime: 4 }));
    await player.toggleVoice('a2', 'https://x/2');
    await player.toggleVoice('a1', 'https://x/1');
    const again = mockPlayers[mockPlayers.length - 1];
    again.listener?.(status({ currentTime: 0, playing: false }));
    expect(again.seeks).toContain(4);
  });

  it('plays the next unplayed voice message 400 ms after one finishes', async () => {
    jest.useFakeTimers();
    const unregister = player.setVoiceNext((id) => (id === 'a1' ? { id: 'a2', uri: 'https://x/2' } : null));
    await player.toggleVoice('a1', 'https://x/1');
    mockPlayers[mockPlayers.length - 1].listener?.(status({ didJustFinish: true, playing: false }));
    jest.advanceTimersByTime(399);
    expect(player.voiceState().id).toBe('a1');
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(player.voiceState().id).toBe('a2');
    unregister();
    jest.useRealTimers();
  });
});

describe('next voice in a thread', () => {
  const messages = [message(1, '', true), message(2, '', true), message(3, '<p>ok</p>', false), message(4, '', true)];

  it('picks the next consecutive voice message that was not played', () => {
    expect(nextVoiceAfter(messages, 'a10', () => false)?.attachment.id).toBe(20);
  });

  it('stops at a text message in between, at the end, and at one already played', () => {
    expect(nextVoiceAfter(messages, 'a20', () => false)).toBeNull();
    expect(nextVoiceAfter(messages, 'a40', () => false)).toBeNull();
    expect(nextVoiceAfter(messages, 'a10', (id) => id === 'a20')).toBeNull();
    expect(nextVoiceAfter(messages, 'a99', () => false)).toBeNull();
  });
});
