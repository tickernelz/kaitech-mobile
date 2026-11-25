import { getRecordingPermissionsAsync, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';
import type { AudioRecorder } from 'expo-audio/build/AudioModule.types';
import { createRecordingOptions } from 'expo-audio/build/utils/options';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { useEffect, useReducer, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform, type GestureResponderEvent } from 'react-native';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { meetingRecording } from '../../../../audio/meeting';
import { callState, subscribeCall } from '../../../call/call';
import { notify } from '../../../../ui/dialog';
import { askPermission } from '../../../../ui/permission';
import { deferUndoable } from '../../../../ui/undo';
import { adoptFile } from '../../files';
import { dropVoiceDraft, partFile, readVoiceDraft, writeVoiceDraft } from '../../voice/draft';
import { joinParts } from '../../voice/join';
import { base64Of, levelOf, waveformOf } from '../../voice/levels';
import { ClockStore, voiceLimitMs } from '../../voice/clock';
import { idle, voiceStep, type Interruption, type VoiceState } from '../../voice/machine';
import { stopVoice } from '../../voicePlayer';
import { cancelHintDistance, dragFrom, dragTo, releaseOf, tooShort, type Drag } from './gesture';

export type Voice = { uri: string; name: string; mimetype: string; size: number; voice: true; durationMs: number; waveform: string | null };

const minFreeBytes = 50 * 1024 * 1024;
const startTimeoutMs = 2000;
const meterMs = 100;
const hintMs = 2800;
const now = () => Date.now();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const voiceOptions = createRecordingOptions({ ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000, sampleRate: 44100, isMeteringEnabled: true, directory: 'document' });

const quietly = (work: () => Promise<unknown>) => void work().catch(() => undefined);

export const haptic = {
  start: () => quietly(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  tick: () => quietly(() => Haptics.selectionAsync()),
  lock: () => quietly(() => (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm) : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light))),
  reject: () => quietly(() => (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))),
  error: () => quietly(() => (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Reject) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error))),
  send: () => quietly(() => (Platform.OS === 'android' ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm) : Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))),
};

function callBusy(): boolean {
  const phase = callState().phase;
  return phase !== 'idle' && phase !== 'ended';
}

export type VoiceRecorder = {
  state: VoiceState;
  clock: ClockStore;
  dx: SharedValue<number>;
  dy: SharedValue<number>;
  level: SharedValue<number>;
  hint: boolean;
  draftUri: string | null;
  hold: {
    onTouchStart: (event: GestureResponderEvent) => void;
    onTouchMove: (event: GestureResponderEvent) => void;
    onTouchEnd: () => void;
    onTouchCancel: () => void;
  };
  startLocked: () => void;
  pause: () => void;
  resume: () => void;
  send: () => void;
  discard: () => void;
};

export function useVoiceRecorder({ accountId, channelId, tapMode, onSend }: { accountId: string; channelId: number; tapMode: boolean; onSend: (voice: Voice) => void }): VoiceRecorder {
  const { t } = useTranslation('chat');
  const [restored] = useState(() => readVoiceDraft(accountId, channelId));
  const [restoredParts] = useState(() => (restored ? restored.parts.map((name) => partFile(accountId, channelId, name).uri) : []));
  const [state, dispatch] = useReducer(voiceStep, restored ? ({ phase: 'paused', reason: 'restored' } as VoiceState) : idle);
  const [hint, setHint] = useState(false);
  const [clock] = useState(() => new ClockStore());
  const stateRef = useRef(state);
  const recorder = useRef<AudioRecorder | null>(null);
  const parts = useRef<string[]>(restoredParts);
  const base = useRef(restored?.durationMs ?? 0);
  const session = useRef(0);
  const drag = useRef<Drag>(dragFrom(0, 0));
  const meter = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = useRef<Promise<void>>(Promise.resolve());
  const sendRef = useRef(onSend);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);
  const level = useSharedValue(0);
  const [draftUri, setDraftUri] = useState<string | null>(restoredParts[0] ?? null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    sendRef.current = onSend;
  }, [onSend]);
  useEffect(() => {
    if (restored) clock.restore(restored.levels, restored.durationMs);
  }, [clock, restored]);

  const serial = (work: () => Promise<void>) => {
    busy.current = busy.current.then(work, work).catch(() => undefined);
    return busy.current;
  };

  const stopMeter = () => {
    if (meter.current) clearInterval(meter.current);
    meter.current = null;
  };

  const reset = () => {
    stopMeter();
    parts.current = [];
    base.current = 0;
    clock.restore([], 0);
    level.set(0);
    setDraftUri(null);
  };

  const persist = () => {
    if (!parts.current.length) return;
    writeVoiceDraft(accountId, channelId, { parts: parts.current.map((uri) => new File(uri).name), durationMs: base.current, levels: clock.levels });
  };

  const stopSegment = async () => {
    stopMeter();
    const made = recorder.current;
    if (!made || !made.isRecording) return;
    const segment = made.getStatus().durationMillis;
    await made.stop();
    const uri = made.uri;
    if (!uri) return;
    const target = partFile(accountId, channelId, `part-${now()}.m4a`);
    new File(uri).move(target);
    parts.current = [...parts.current, target.uri];
    base.current += segment;
    clock.set(base.current, false);
  };

  const collapse = async () => {
    if (parts.current.length < 2) {
      setDraftUri(parts.current[0] ?? null);
      return;
    }
    const target = partFile(accountId, channelId, `joined-${now()}.m4a`);
    const joined = await joinParts(parts.current, target.uri);
    for (const uri of parts.current) {
      const file = new File(uri);
      if (file.exists && file.uri !== joined) file.delete();
    }
    parts.current = [joined];
    setDraftUri(joined);
  };

  const startMeter = () => {
    stopMeter();
    meter.current = setInterval(() => {
      const made = recorder.current;
      if (!made) return;
      const status = made.getStatus();
      if (status.mediaServicesDidReset) {
        void pauseFor('device');
        return;
      }
      const durationMs = base.current + status.durationMillis;
      const next = levelOf(status.metering);
      clock.push(next);
      level.set(withTiming(next, { duration: next > level.get() ? 80 : 240 }));
      clock.set(durationMs, true);
      if (durationMs >= voiceLimitMs) void pauseFor('limit');
    }, meterMs);
  };

  const fail = (text: string) => {
    dispatch({ type: 'fail' });
    haptic.error();
    notify(text);
  };

  const abandon = async (made: NonNullable<typeof recorder.current>) => {
    await made.stop().catch(() => undefined);
    if (made.uri) new File(made.uri).delete();
  };

  const start = async (mine: number) => {
    if (meetingRecording() || callBusy()) {
      fail(t('composer.micBusy'));
      return;
    }
    if (!(await getRecordingPermissionsAsync()).granted) {
      dispatch({ type: 'fail' });
      if (await askPermission('microphone', getRecordingPermissionsAsync, requestRecordingPermissionsAsync)) notify(t('composer.micReady'));
      return;
    }
    if (Paths.availableDiskSpace < minFreeBytes) {
      fail(t('composer.diskFull'));
      return;
    }
    stopVoice();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    const made = recorder.current ?? new AudioModule.AudioRecorder(voiceOptions);
    recorder.current = made;
    await made.prepareToRecordAsync();
    if (mine !== session.current) {
      await abandon(made);
      return;
    }
    made.record();
    const deadline = now() + startTimeoutMs;
    while (!made.getStatus().isRecording) {
      if (now() > deadline) {
        await abandon(made);
        throw new Error('startTimeout');
      }
      await sleep(20);
    }
    if (mine !== session.current) {
      await abandon(made);
      return;
    }
    dispatch({ type: 'live' });
    haptic.start();
    startMeter();
  };

  const begin = (locked: boolean) => {
    const mine = ++session.current;
    dispatch({ type: locked ? 'start-locked' : 'press' });
    void serial(() =>
      start(mine).catch(() => {
        if (mine === session.current) fail(t('composer.micFailed'));
      }),
    );
  };

  const pauseFor = (reason: Interruption | null) =>
    serial(async () => {
      if (stateRef.current.phase !== 'recording') return;
      await stopSegment();
      await collapse();
      persist();
      dispatch({ type: 'pause', ...(reason ? { reason } : {}) });
      if (!reason) haptic.tick();
    });

  const finishSend = () =>
    serial(async () => {
      session.current++;
      await stopSegment();
      if (!parts.current.length) {
        reset();
        dispatch({ type: 'done' });
        return;
      }
      const durationMs = base.current;
      const joined = await joinParts(parts.current, partFile(accountId, channelId, `voice-${now()}.m4a`).uri);
      const name = `voice-${new Date(now() - durationMs).toISOString().replace(/[:.]/g, '-')}.m4a`;
      const kept = await adoptFile(joined, name);
      const waveform = clock.levels.length ? base64Of(waveformOf(clock.levels)) : null;
      dropVoiceDraft(accountId, channelId);
      reset();
      dispatch({ type: 'done' });
      haptic.send();
      sendRef.current({ uri: kept.uri, name, mimetype: 'audio/mp4', size: kept.size, voice: true, durationMs, waveform });
    }).catch(() => fail(t('composer.voiceSendFailed')));

  const throwAway = () =>
    serial(async () => {
      session.current++;
      await stopSegment();
      dropVoiceDraft(accountId, channelId);
      reset();
      dispatch({ type: 'done' });
    });

  const discard = () => {
    const phase = stateRef.current.phase;
    if (phase === 'idle' || phase === 'cancelled') return;
    if (phase === 'pressing') {
      session.current++;
      dispatch({ type: 'cancel' });
      return;
    }
    void serial(async () => {
      session.current++;
      await stopSegment();
      await collapse();
      persist();
      dispatch({ type: 'cancel' });
      haptic.reject();
      deferUndoable({
        label: t('composer.voiceDiscarded'),
        apply: () => undefined,
        revert: () => dispatch({ type: 'undo' }),
        commit: async () => {
          if (stateRef.current.phase === 'cancelled') {
            dropVoiceDraft(accountId, channelId);
            reset();
            dispatch({ type: 'done' });
          }
          return true;
        },
      });
    });
  };

  const release = () => {
    const current = stateRef.current;
    if (current.phase === 'pressing' && !current.locked) {
      session.current++;
      dispatch({ type: 'release' });
      setHint(true);
      return;
    }
    if (current.phase !== 'recording' || current.locked) return;
    const durationMs = base.current + (recorder.current?.getStatus().durationMillis ?? 0);
    if (tooShort(durationMs)) {
      void throwAway();
      setHint(true);
      return;
    }
    void finishSend();
  };

  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(false), hintMs);
    return () => clearTimeout(timer);
  }, [hint]);

  const hold = {
    onTouchStart: (event: GestureResponderEvent) => {
      drag.current = dragFrom(event.nativeEvent.pageX, event.nativeEvent.pageY);
      dx.set(0);
      dy.set(0);
      if (tapMode || stateRef.current.phase !== 'idle') return;
      setHint(false);
      begin(false);
    },
    onTouchMove: (event: GestureResponderEvent) => {
      if (tapMode) return;
      const before = drag.current;
      const next = dragTo(before, event.nativeEvent.pageX, event.nativeEvent.pageY);
      drag.current = next;
      dx.set(next.dx);
      dy.set(next.dy);
      if (next.dx <= -cancelHintDistance && before.dx > -cancelHintDistance) haptic.tick();
      if (next.locked && !before.locked) {
        dispatch({ type: 'lock' });
        haptic.lock();
      }
    },
    onTouchEnd: () => {
      dx.set(0);
      dy.set(0);
      if (tapMode) {
        if (stateRef.current.phase === 'idle') begin(true);
        return;
      }
      const outcome = releaseOf(drag.current);
      if (outcome === 'keep') return;
      if (outcome === 'cancel') discard();
      else release();
    },
    onTouchCancel: () => {
      dx.set(0);
      dy.set(0);
      if (tapMode || drag.current.locked) return;
      const current = stateRef.current;
      if (current.phase === 'pressing') {
        session.current++;
        dispatch({ type: 'cancel' });
      } else void pauseFor(null);
    },
  };

  const pauseRef = useRef(pauseFor);
  const leaveRef = useRef(() => Promise.resolve());
  useEffect(() => {
    pauseRef.current = pauseFor;
    leaveRef.current = async () => {
      session.current++;
      const made = recorder.current;
      recorder.current = null;
      if (!made) return;
      try {
        if (made.isRecording) {
          stopMeter();
          const segment = made.getStatus().durationMillis;
          await made.stop();
          if (made.uri) {
            const target = partFile(accountId, channelId, `part-${now()}.m4a`);
            new File(made.uri).move(target);
            parts.current = [...parts.current, target.uri];
            base.current += segment;
            persist();
          }
        }
      } finally {
        made.release();
      }
    };
  });

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') void pauseRef.current('background');
    });
    const unsubscribe = subscribeCall(() => {
      if (callBusy()) void pauseRef.current('call');
    });
    return () => {
      subscription.remove();
      unsubscribe();
      if (meter.current) clearInterval(meter.current);
      void leaveRef.current().catch(() => undefined);
    };
  }, []);

  return {
    state,
    clock,
    dx,
    dy,
    level,
    hint,
    draftUri,
    hold,
    startLocked: () => {
      if (stateRef.current.phase === 'idle') begin(true);
    },
    pause: () => void pauseFor(null),
    resume: () => {
      if (stateRef.current.phase !== 'paused') return;
      stopVoice();
      const mine = ++session.current;
      dispatch({ type: 'resume' });
      void serial(() =>
        start(mine).catch(() => {
          if (mine === session.current) fail(t('composer.micFailed'));
        }),
      );
    },
    send: () => {
      const phase = stateRef.current.phase;
      if (phase === 'recording' || phase === 'paused') void finishSend();
    },
    discard,
  };
}
