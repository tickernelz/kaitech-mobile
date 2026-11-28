import { useLocalSearchParams } from 'expo-router';
import { useCan } from '../../../auth/useAccess';
import { AdminScreen, type AdminPart } from '../../../features/mom/AdminScreens';
import { Gate } from '../../../screens/Gate';

const parts: AdminPart[] = ['keys', 'settings', 'import'];

export default function AdminRoute() {
  const params = useLocalSearchParams<{ part: string }>();
  const momAdmin = useCan('mom.admin');
  const part = parts.find((one) => one === params.part);
  if (!part) return null;
  if (part !== 'keys' && !momAdmin) return <Gate kind="admin" />;
  return <AdminScreen part={part} />;
}
