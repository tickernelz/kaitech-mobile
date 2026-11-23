import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../features/discovery/params';
import { RecordingDepartmentsScreen } from '../../features/mom/RecordingScreens';

export default function RecordingDepartmentsRoute() {
  const params = useLocalSearchParams<{ recording: string; meeting: string }>();
  const recording = idParam(params.recording);
  const meeting = idParam(params.meeting);
  if (!recording || !meeting) return null;
  return <RecordingDepartmentsScreen recording={recording} meeting={meeting} />;
}
