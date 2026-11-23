import { useLocalSearchParams } from 'expo-router';
import { AdminScreen, type AdminPart } from '../../../features/mom/AdminScreens';

const parts: AdminPart[] = ['keys', 'settings', 'import'];

export default function AdminRoute() {
  const params = useLocalSearchParams<{ part: string }>();
  const part = parts.find((one) => one === params.part);
  if (!part) return null;
  return <AdminScreen part={part} />;
}
