import { useLocalSearchParams } from 'expo-router';
import { useCan } from '../../../auth/useAccess';
import { idParam } from '../../../features/discovery/params';
import { UserScreen } from '../../../features/users/UserScreen';
import { Gate } from '../../../screens/Gate';

export default function UserRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = idParam(params.id);
  const manages = useCan('users.manage');
  if (!manages) return <Gate kind="admin" />;
  return id ? <UserScreen userId={id} /> : null;
}
