import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { FollowupScreen } from '../../../features/mom/FollowupScreen';

export default function FollowupRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = idParam(params.id);
  if (!id) return null;
  return <FollowupScreen id={id} />;
}
