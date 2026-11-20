import { useLocalSearchParams } from 'expo-router';
import { ConversationsScreen } from '../../../features/discovery/ConversationsScreen';
import { idParam } from '../../../features/discovery/params';

export default function ConversationsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const programme = idParam(params.id);
  return programme ? <ConversationsScreen programme={programme} /> : null;
}
