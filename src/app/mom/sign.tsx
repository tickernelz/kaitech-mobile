import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../features/discovery/params';
import { SignScreen } from '../../features/mom/SignScreen';

export default function SignRoute() {
  const params = useLocalSearchParams<{ programme: string; meeting: string }>();
  const programme = idParam(params.programme);
  const meeting = idParam(params.meeting);
  if (!programme || !meeting) return null;
  return <SignScreen programme={programme} meeting={meeting} />;
}
