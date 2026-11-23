import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { RecordScreen } from '../../../features/records/RecordScreen';

export default function RecordRoute() {
  const params = useLocalSearchParams<{ id: string; model: string; rid?: string; stash?: string }>();
  const programme = idParam(params.id);
  if (!programme || !params.model) return null;
  return <RecordScreen key={`${params.model}-${params.rid ?? ''}-${params.stash ?? ''}`} programme={programme} model={params.model} rid={idParam(params.rid) ?? null} stashKey={params.stash} />;
}
