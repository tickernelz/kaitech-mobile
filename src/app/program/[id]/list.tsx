import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { RecordListScreen } from '../../../features/records/RecordListScreen';

export default function ListRoute() {
  const params = useLocalSearchParams<{ id: string; action?: string; stash?: string }>();
  const programme = idParam(params.id);
  if (!programme) return null;
  return <RecordListScreen programme={programme} actionId={idParam(params.action) ?? undefined} stashKey={params.stash} />;
}
