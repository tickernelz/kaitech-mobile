import { useLocalSearchParams } from 'expo-router';
import { RecordingPlayer } from '../../features/call/ui/RecordingPlayer';
import { DialogLayer } from '../../ui/Dialog';

export default function RecordingRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return (
    <>
      <RecordingPlayer id={id} />
      <DialogLayer />
    </>
  );
}
