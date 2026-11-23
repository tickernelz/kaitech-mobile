import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { EditorScreen } from '../../../features/mom/EditorScreen';

export default function EditorRoute() {
  const params = useLocalSearchParams<{ recording: string }>();
  const recording = idParam(params.recording);
  if (!recording) return null;
  return <EditorScreen recording={recording} />;
}
