import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { FollowupFormScreen } from '../../../features/mom/FollowupFormScreen';

export default function FollowupEditRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = idParam(params.id);
  if (!id) return null;
  return <FollowupFormScreen id={id} />;
}
