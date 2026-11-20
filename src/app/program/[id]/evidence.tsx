import { useLocalSearchParams } from 'expo-router';
import { EvidenceScreen } from '../../../features/discovery/EvidenceScreen';
import { idParam } from '../../../features/discovery/params';

export default function EvidenceRoute() {
  const params = useLocalSearchParams<{ id: string; view?: string }>();
  const programme = idParam(params.id);
  if (!programme) return null;
  return <EvidenceScreen programme={programme} initial={params.view === 'evidence' ? 'evidence' : 'findings'} />;
}
