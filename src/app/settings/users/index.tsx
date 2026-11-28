import { useCan } from '../../../auth/useAccess';
import { UsersScreen } from '../../../features/users/UsersScreen';
import { Gate } from '../../../screens/Gate';

export default function UsersRoute() {
  return useCan('users.manage') ? <UsersScreen /> : <Gate kind="admin" />;
}
