import { useLocalSearchParams } from 'expo-router';
import { CardScreen } from '../../../features/discovery/CardScreen';
import { idParam } from '../../../features/discovery/params';

export default function CardRoute() {
  const params = useLocalSearchParams<{ id: string; programme?: string; conversation?: string }>();
  const id = idParam(params.id);
  if (!id) return null;
  return <CardScreen id={id} programme={idParam(params.programme)} conversation={idParam(params.conversation)} />;
}
