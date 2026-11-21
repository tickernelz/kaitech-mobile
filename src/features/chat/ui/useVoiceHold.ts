import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import AudioModule from 'expo-audio/build/AudioModule';
import type { AudioRecorder } from 'expo-audio/build/AudioModule.types';
import { createRecordingOptions } from 'expo-audio/build/utils/options';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, type GestureResponderEvent } from 'react-native';
import { meetingRecording } from '../../../audio/meeting';
import { adoptFile, dropFile } from '../files';
import { stopVoice } from '../voicePlayer';
import { askForSettings } from './attach';

export type Recording = { started: number; elapsed: number; offset: number };
export type Voice = { uri: string; name: string; mimetype: string; size: number; voice: true; durationMs: number };

export const cancelDistance = 96;
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

  const startRecording = async () => {
    if (meetingRecording()) {
      Alert.alert('', t('composer.micBusy'));
      return;
    }
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      if (!permission.canAskAgain) askForSettings(t, 'microphone');
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
    const started = { started: now(), elapsed: 0, offset: 0 };
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
      if (!cancel) Alert.alert('', t('composer.holdToRecord'));
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const name = `voice-${new Date(started).toISOString().replace(/[:.]/g, '-')}.m4a`;
    const kept = await adoptFile(uri, name);
    recorded.current({ uri: kept.uri, name, mimetype: 'audio/mp4', size: kept.size, voice: true, durationMs: elapsed });
  };

  const starting = useRef<Promise<void> | null>(null);
  const touch = useRef({ x: 0, dx: 0 });
  const hold = {
    onTouchStart: (event: GestureResponderEvent) => {
      touch.current = { x: event.nativeEvent.pageX, dx: 0 };
      starting.current = startRecording().finally(() => {
        starting.current = null;
      });
    },
    onTouchMove: (event: GestureResponderEvent) => {
      const dx = Math.min(0, event.nativeEvent.pageX - touch.current.x);
      touch.current.dx = dx;
      setRecording((current) => (current ? { ...current, offset: dx } : current));
    },
    onTouchEnd: () => {
      const cancel = touch.current.dx < -cancelDistance;
      void (starting.current ?? Promise.resolve()).then(() => finishRecording(cancel));
    },
    onTouchCancel: () => {
      void (starting.current ?? Promise.resolve()).then(() => finishRecording(true));
    },
  };

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

  return { recording, hold };
}
