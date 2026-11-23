import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { KnowledgeScreen } from '../../../features/records/ClientScreens';

export default function KnowledgeRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const programme = idParam(params.id);
  if (!programme) return null;
  return <KnowledgeScreen programme={programme} />;
}
