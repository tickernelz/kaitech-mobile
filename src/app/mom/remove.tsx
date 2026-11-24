import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../features/discovery/params';
import { RemoveScreen } from '../../features/mom/RemoveScreen';

export default function RemoveRoute() {
  const params = useLocalSearchParams<{ recording: string; meeting: string }>();
  const recording = idParam(params.recording);
  const meeting = idParam(params.meeting);
  if (!recording || !meeting) return null;
  return <RemoveScreen recording={recording} meeting={meeting} />;
}
