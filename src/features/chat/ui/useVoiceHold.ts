import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
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
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: 'document' });
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
    await recorder.prepareToRecordAsync();
    recorder.record();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRecording({ started: now(), elapsed: 0, offset: 0 });
  };

  const recordingActive = recording !== null;
  useEffect(() => {
    if (!recordingActive) return;
    const timer = setInterval(() => setRecording((current) => (current ? { ...current, elapsed: now() - current.started } : current)), 250);
    return () => clearInterval(timer);
  }, [recordingActive]);

  const finishRecording = async (cancel: boolean) => {
    const current = recordingRef.current;
    if (!current) return;
    setRecording(null);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: meetingRecording(), playsInSilentMode: true });
    const uri = recorder.uri;
    const elapsed = now() - current.started;
    if (!uri) return;
    if (cancel || elapsed < shortestVoiceMs) {
      dropFile(uri);
      if (!cancel) Alert.alert('', t('composer.holdToRecord'));
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const name = `voice-${new Date(current.started).toISOString().replace(/[:.]/g, '-')}.m4a`;
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

  return { recording, hold };
}
