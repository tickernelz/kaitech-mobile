import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { RecordingHistoryScreen } from '../../../features/mom/RecordingScreens';

export default function RecordingHistoryRoute() {
  const params = useLocalSearchParams<{ recording: string }>();
  const recording = idParam(params.recording);
  if (!recording) return null;
  return <RecordingHistoryScreen recording={recording} />;
}
