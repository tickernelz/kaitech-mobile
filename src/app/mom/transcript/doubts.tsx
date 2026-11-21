import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { DoubtsScreen } from '../../../features/mom/EditorParts';

export default function DoubtsRoute() {
  const params = useLocalSearchParams<{ recording: string }>();
  const recording = idParam(params.recording);
  if (!recording) return null;
  return <DoubtsScreen recording={recording} />;
}
