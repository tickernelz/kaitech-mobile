import { useLocalSearchParams } from 'expo-router';
import { CallScreen } from '../../features/call/ui/CallScreen';

export default function CallRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return <CallScreen />;
}
