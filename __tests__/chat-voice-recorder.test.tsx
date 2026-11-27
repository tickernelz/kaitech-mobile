import { act, renderHook } from '@testing-library/react-native';
import { AppState } from 'react-native';
import '../src/i18n';

const mockFiles = new Map<string, string>();
const mockNotify = jest.fn();
const mockAsk = jest.fn(async () => false);
const mockPermission = { granted: true };
const mockMeeting = { on: false };
let mockFreeBytes = 10 * 1024 * 1024 * 1024;
let mockRecorder: { isRecording: boolean; uri: string | null; durationMillis: number; metering: number; prepared: number } | null = null;
let mockSerial = 0;
let mockPrepareGate: Promise<void> | null = null;

jest.mock('expo-sqlite/kv-store', () => ({ __esModule: true, default: { getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }, getItemSync: () => null, setItemSync: () => undefined, removeItemSync: () => undefined }));
jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts
      .map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri))
      .reduce((left, right) => left.replace(/[/]+$/, '') + '/' + right.replace(/^[/]+/, ''));
  class MockFile {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get name() {
      return this.uri.split('/').pop() ?? '';
    }
    create() {
      mockFiles.set(this.uri, '');
    }
    write(text: string) {
      mockFiles.set(this.uri, text);
    }
    textSync() {
      return mockFiles.get(this.uri) ?? '';
    }
    move(target: { uri: string }) {
      mockFiles.set(target.uri, mockFiles.get(this.uri) ?? '');
      mockFiles.delete(this.uri);
      this.uri = target.uri;
    }
    delete() {
      mockFiles.delete(this.uri);
    }
  }
  class MockDirectory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {
      return undefined;
    }
    get exists() {
      return [...mockFiles.keys()].some((key) => key.startsWith(this.uri + '/'));
    }
    delete() {
      for (const key of [...mockFiles.keys()]) if (key.startsWith(this.uri + '/')) mockFiles.delete(key);
    }
  }
  return {
    File: MockFile,
    Directory: MockDirectory,
    Paths: {
      document: { uri: 'file:///doc' },
      get availableDiskSpace() {
        return mockFreeBytes;
      },
    },
  };
});
jest.mock('expo-audio', () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  getRecordingPermissionsAsync: jest.fn(async () => ({ granted: mockPermission.granted, canAskAgain: true })),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true })),
  setAudioModeAsync: jest.fn(async () => undefined),
}));
jest.mock('expo-audio/build/utils/options', () => ({ createRecordingOptions: (options: unknown) => options }));
jest.mock('expo-audio/build/AudioModule', () => ({
  __esModule: true,
  default: {
    AudioRecorder: class {
      isRecording = false;
      uri: string | null = null;
      durationMillis = 0;
      metering = -20;
      prepared = 0;
      constructor() {
        mockRecorder = this;
      }
      ready = false;
      async prepareToRecordAsync() {
        if (this.ready) throw new Error('AudioRecorderAlreadyPrepared');
        this.ready = true;
        if (mockPrepareGate) await mockPrepareGate;
        this.prepared++;
      }
      record() {
        this.isRecording = true;
        this.durationMillis = 0;
        this.uri = `file:///cache/rec-${++mockSerial}.m4a`;
        mockFiles.set(this.uri, 'audio');
      }
      getStatus() {
        return { isRecording: this.isRecording, durationMillis: this.durationMillis, metering: this.metering, mediaServicesDidReset: false, canRecord: true, url: this.uri, fileSize: 0 };
      }
      async stop() {
        this.isRecording = false;
        this.ready = false;
      }
      release() {
        return undefined;
      }
    },
  },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => undefined),
  selectionAsync: jest.fn(async () => undefined),
  notificationAsync: jest.fn(async () => undefined),
  performAndroidHapticsAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: 'medium', Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  AndroidHaptics: { Confirm: 'confirm', Reject: 'reject' },
}));
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: number) => {
    let current = value;
    return { get: () => current, set: (next: number) => (current = next) };
  },
  withTiming: (value: number) => value,
}));
jest.mock('../src/audio/meeting', () => ({ meetingRecording: () => mockMeeting.on }));
jest.mock('../src/features/call/call', () => ({ callState: () => ({ phase: 'idle' }), subscribeCall: () => () => undefined }));
jest.mock('../src/ui/dialog', () => ({ notify: (text: string) => mockNotify(text) }));
jest.mock('../src/ui/permission', () => ({ askPermission: (...args: unknown[]) => mockAsk(...(args as [])) }));
jest.mock('../src/auth/session', () => ({ onAccountForgotten: jest.fn() }));
jest.mock('../src/features/chat/voicePlayer', () => ({ stopVoice: jest.fn() }));
jest.mock('../src/features/chat/files', () => ({ adoptFile: jest.fn(async (uri: string, name: string) => ({ uri: `chat-outbox/x/${name}`, size: 12 })) }));
jest.mock('../src/features/chat/voice/join', () => ({
  joinParts: jest.fn(async (parts: string[], target: string) => {
    if (parts.length === 1) return parts[0];
    mockFiles.set(target, 'joined');
    return target;
  }),
}));

const { useVoiceRecorder } = require('../src/features/chat/ui/composer/useVoiceRecorder') as typeof import('../src/features/chat/ui/composer/useVoiceRecorder');
const { voiceLimitMs } = require('../src/features/chat/voice/clock') as typeof import('../src/features/chat/voice/clock');
const { undoLast } = require('../src/ui/undo') as typeof import('../src/ui/undo');

const touch = (x = 300, y = 700) => ({ nativeEvent: { pageX: x, pageY: y } }) as never;
const draftKey = 'file:///doc/chat-voice-draft/a/12/draft.json';

async function mount(tapMode = false) {
  const onSend = jest.fn();
  const view = await renderHook(() => useVoiceRecorder({ accountId: 'a', channelId: 12, tapMode, onSend }));
  return { ...view, onSend };
}

async function flush() {
  await act(async () => {
    for (let index = 0; index < 5; index++) await Promise.resolve();
    jest.advanceTimersByTime(50);
    for (let index = 0; index < 5; index++) await Promise.resolve();
  });
}

async function press(result: { current: ReturnType<typeof useVoiceRecorder> }) {
  await act(async () => result.current.hold.onTouchStart(touch()));
  await flush();
}

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await flush();
}

let appStateChange: ((state: string) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  appStateChange = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateChange = handler as (state: string) => void;
    return { remove: () => undefined } as never;
  });
  mockFiles.clear();
  mockNotify.mockClear();
  mockAsk.mockClear();
  mockPermission.granted = true;
  mockMeeting.on = false;
  mockFreeBytes = 10 * 1024 * 1024 * 1024;
  mockRecorder = null;
  mockPrepareGate = null;
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe('voice recorder', () => {
  it('starts only once the microphone is live, and sends a hold of at least one second with a waveform', async () => {
    const { result, onSend } = await mount();
    await press(result);
    expect(result.current.state).toEqual({ phase: 'recording', locked: false });
    mockRecorder!.durationMillis = 1500;
    await advance(300);
    await act(async () => result.current.hold.onTouchEnd());
    await flush();
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ voice: true, durationMs: 1500, mimetype: 'audio/mp4', waveform: expect.any(String) }));
    expect(result.current.state.phase).toBe('idle');
    expect(mockFiles.has(draftKey)).toBe(false);
  });

  it('throws away a hold under one second and shows the hint instead of sending', async () => {
    const { result, onSend } = await mount();
    await press(result);
    mockRecorder!.durationMillis = 999;
    await act(async () => result.current.hold.onTouchEnd());
    await flush();
    expect(onSend).not.toHaveBeenCalled();
    expect(result.current.hint).toBe(true);
    expect(result.current.state.phase).toBe('idle');
    await advance(2800);
    expect(result.current.hint).toBe(false);
  });

  it('shows the hint for a tap released before the microphone is live, and the next hold still records', async () => {
    const { result, onSend } = await mount();
    let open = () => undefined as void;
    mockPrepareGate = new Promise<void>((resolve) => (open = resolve));
    await act(async () => result.current.hold.onTouchStart(touch()));
    expect(result.current.state.phase).toBe('pressing');
    await act(async () => result.current.hold.onTouchEnd());
    mockPrepareGate = null;
    open();
    await flush();
    expect(result.current.state.phase).toBe('idle');
    expect(result.current.hint).toBe(true);
    expect(mockRecorder!.isRecording).toBe(false);
    await press(result);
    expect(result.current.state).toEqual({ phase: 'recording', locked: false });
    expect(mockNotify).not.toHaveBeenCalled();
    mockRecorder!.durationMillis = 1500;
    await act(async () => result.current.hold.onTouchEnd());
    await flush();
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('pauses instead of sending when the app goes to the background, and keeps the draft on disk', async () => {
    const { result, onSend } = await mount();
    await press(result);
    mockRecorder!.durationMillis = 4000;
    await act(async () => appStateChange?.('background'));
    await flush();
    expect(result.current.state).toEqual({ phase: 'paused', reason: 'background' });
    expect(onSend).not.toHaveBeenCalled();
    expect(JSON.parse(mockFiles.get(draftKey) ?? '{}')).toMatchObject({ durationMs: 4000 });
  });

  it('restores a saved draft as paused when the chat opens again', async () => {
    mockFiles.set('file:///doc/chat-voice-draft/a/12/part-1.m4a', 'audio');
    mockFiles.set(draftKey, JSON.stringify({ parts: ['part-1.m4a'], durationMs: 7000, levels: [0.5] }));
    const { result } = await mount();
    expect(result.current.state).toEqual({ phase: 'paused', reason: 'restored' });
    expect(result.current.draftUri).toBe('file:///doc/chat-voice-draft/a/12/part-1.m4a');
    expect(result.current.clock.get().durationMs).toBe(7000);
  });

  it('pauses by itself at the 30-minute limit', async () => {
    const { result } = await mount();
    await press(result);
    mockRecorder!.durationMillis = voiceLimitMs;
    await advance(200);
    expect(result.current.state).toEqual({ phase: 'paused', reason: 'limit' });
  });

  it('does not start with less than 50 MB free and says why', async () => {
    mockFreeBytes = 49 * 1024 * 1024;
    const { result } = await mount();
    await press(result);
    expect(result.current.state.phase).toBe('idle');
    expect(mockRecorder).toBeNull();
    expect(mockNotify).toHaveBeenCalledWith('Storage is almost full. Delete some files and try again.');
  });

  it('does not start while a meeting recording holds the microphone', async () => {
    mockMeeting.on = true;
    const { result } = await mount();
    await press(result);
    expect(result.current.state.phase).toBe('idle');
    expect(mockRecorder).toBeNull();
    expect(mockNotify).toHaveBeenCalledWith('The microphone is in use by a meeting recording or a call.');
  });

  it('asks with the Kaitech card first when the microphone is not allowed, and never records on that press', async () => {
    mockPermission.granted = false;
    const { result } = await mount();
    await press(result);
    expect(mockAsk).toHaveBeenCalledWith('microphone', expect.any(Function), expect.any(Function));
    expect(result.current.state.phase).toBe('idle');
    expect(mockRecorder).toBeNull();
  });

  it('locks by sliding up, pauses, and Undo after discarding brings the draft back', async () => {
    const { result, onSend } = await mount();
    await press(result);
    await act(async () => result.current.hold.onTouchMove(touch(300, 700 - 70)));
    await act(async () => result.current.hold.onTouchEnd());
    expect(result.current.state).toEqual({ phase: 'recording', locked: true });
    mockRecorder!.durationMillis = 3000;
    await act(async () => result.current.pause());
    await flush();
    expect(result.current.state).toEqual({ phase: 'paused', reason: null });
    await act(async () => result.current.discard());
    await flush();
    expect(result.current.state.phase).toBe('cancelled');
    await act(async () => undoLast());
    expect(result.current.state).toEqual({ phase: 'paused', reason: null });
    expect(mockFiles.has(draftKey)).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('deletes the discarded recording once the undo window passes', async () => {
    const { result } = await mount();
    await press(result);
    await act(async () => result.current.hold.onTouchMove(touch(300 - 100, 700)));
    mockRecorder!.durationMillis = 2000;
    await act(async () => result.current.hold.onTouchEnd());
    await flush();
    expect(result.current.state.phase).toBe('cancelled');
    await advance(5000);
    expect(result.current.state.phase).toBe('idle');
    expect(mockFiles.has(draftKey)).toBe(false);
  });

  it('records hands-free with one tap when a screen reader is on', async () => {
    const { result } = await mount(true);
    await act(async () => result.current.hold.onTouchStart(touch()));
    await act(async () => result.current.hold.onTouchEnd());
    await flush();
    expect(result.current.state).toEqual({ phase: 'recording', locked: true });
  });
});
