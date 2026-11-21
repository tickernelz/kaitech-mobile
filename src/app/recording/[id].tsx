import { useLocalSearchParams } from 'expo-router';
import { RecordingPlayer } from '../../features/call/ui/RecordingPlayer';

export default function RecordingRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return <RecordingPlayer id={id} />;
}
