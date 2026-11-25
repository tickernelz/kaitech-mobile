import { getRecordingPermissionsAsync, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';
import type { AudioRecorder } from 'expo-audio/build/AudioModule.types';
import { createRecordingOptions } from 'expo-audio/build/utils/options';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GestureResponderEvent } from 'react-native';
import { meetingRecording } from '../../../audio/meeting';
import { adoptFile, dropFile } from '../files';
import { stopVoice } from '../voicePlayer';
import { notify } from '../../../ui/dialog';
import { askPermission } from '../../../ui/permission';
import { dragTo, releaseOf, type Drag } from './composer/gesture';

export type Recording = { started: number; elapsed: number; offset: number; lift: number; locked: boolean };
export type Voice = { uri: string; name: string; mimetype: string; size: number; voice: true; durationMs: number };

const shortestVoiceMs = 800;
const now = () => Date.now();

export function useVoiceHold(onRecorded: (voice: Voice) => void) {
  const { t } = useTranslation('chat');
  const [recording, setRecording] = useState<Recording | null>(null);
  const recorder = useRef<AudioRecorder | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  const recorded = useRef(onRecorded);
  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);
  useEffect(() => {
    recorded.current = onRecorded;
  }, [onRecorded]);
  const failed = () => notify(t('composer.recordFailed'));

  const startRecording = async () => {
    if (meetingRecording()) {
      notify(t('composer.micBusy'));
      return;
    }
    if (!(await getRecordingPermissionsAsync()).granted) {
      await askPermission('microphone', getRecordingPermissionsAsync, requestRecordingPermissionsAsync);
      return;
    }
    stopVoice();
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    const made = new AudioModule.AudioRecorder(createRecordingOptions({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' }));
    recorder.current = made;
    try {
      await made.prepareToRecordAsync();
      made.record();
    } catch (error) {
      recorder.current = null;
      made.release();
      throw error;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const started = { started: now(), elapsed: 0, offset: 0, lift: 0, locked: touch.current.locked };
    recordingRef.current = started;
    setRecording(started);
  };

  const recordingActive = recording !== null;
  useEffect(() => {
    if (!recordingActive) return;
    const timer = setInterval(() => setRecording((current) => (current ? { ...current, elapsed: now() - current.started } : current)), 250);
    return () => clearInterval(timer);
  }, [recordingActive]);

  const finishRecording = async (cancel: boolean) => {
    const made = recorder.current;
    if (!made) return;
    const started = recordingRef.current?.started ?? now();
    recordingRef.current = null;
    recorder.current = null;
    setRecording(null);
    let uri: string | null;
    try {
      await made.stop();
      uri = made.uri;
    } finally {
      made.release();
      await setAudioModeAsync({ allowsRecording: meetingRecording(), playsInSilentMode: true });
    }
    const elapsed = now() - started;
    if (!uri) return;
    if (cancel || elapsed < shortestVoiceMs) {
      dropFile(uri);
      if (!cancel) notify(t('composer.holdToRecord'));
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const name = `voice-${new Date(started).toISOString().replace(/[:.]/g, '-')}.m4a`;
    const kept = await adoptFile(uri, name);
    recorded.current({ uri: kept.uri, name, mimetype: 'audio/mp4', size: kept.size, voice: true, durationMs: elapsed });
  };

  const starting = useRef<Promise<void> | null>(null);
  const touch = useRef<Drag>({ x: 0, y: 0, dx: 0, dy: 0, locked: false });
  const begin = (drag: Drag) => {
    touch.current = drag;
    starting.current = startRecording()
      .catch(() => {
        touch.current = { ...touch.current, locked: false };
        failed();
      })
      .finally(() => {
        starting.current = null;
      });
  };
  const after = (work: () => Promise<void>) =>
    void (starting.current ?? Promise.resolve()).then(work).catch(failed);
  const hold = {
    onTouchStart: (event: GestureResponderEvent) => begin({ x: event.nativeEvent.pageX, y: event.nativeEvent.pageY, dx: 0, dy: 0, locked: false }),
    onTouchMove: (event: GestureResponderEvent) => {
      const before = touch.current;
      const next = dragTo(before, event.nativeEvent.pageX, event.nativeEvent.pageY);
      touch.current = next;
      if (next.locked && !before.locked) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setRecording((current) => (current ? { ...current, offset: next.dx, lift: next.dy, locked: next.locked } : current));
    },
    onTouchEnd: () => {
      const release = releaseOf(touch.current);
      if (release !== 'keep') after(() => finishRecording(release === 'cancel'));
    },
    onTouchCancel: () => {
      if (!touch.current.locked) after(() => finishRecording(true));
    },
  };
  const startLocked = () => begin({ x: 0, y: 0, dx: 0, dy: 0, locked: true });
  const stop = (cancel: boolean) => after(() => finishRecording(cancel));

  const finishing = useRef(finishRecording);
  useEffect(() => {
    finishing.current = finishRecording;
  });
  useEffect(
    () => () => {
      void (starting.current ?? Promise.resolve()).then(() => finishing.current(true));
    },
    [],
  );

  return { recording, hold, startLocked, stop };
}
