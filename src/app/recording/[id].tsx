import { useLocalSearchParams } from 'expo-router';
import { RecordingPlayer } from '../../features/call/ui/RecordingPlayer';
import { TeamOnly } from '../../screens/Gate';
import { DialogLayer } from '../../ui/Dialog';

export default function RecordingRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return null;
  return (
    <>
      <TeamOnly><RecordingPlayer id={id} /></TeamOnly>
      <DialogLayer />
    </>
  );
}
