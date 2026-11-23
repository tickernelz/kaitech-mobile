import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { SpeakersScreen } from '../../../features/mom/EditorParts';

export default function SpeakersRoute() {
  const params = useLocalSearchParams<{ recording: string }>();
  const recording = idParam(params.recording);
  if (!recording) return null;
  return <SpeakersScreen recording={recording} />;
}
