import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { DiagramScreen } from '../../../features/records/ClientScreens';

export default function DiagramRoute() {
  const params = useLocalSearchParams<{ rid: string }>();
  const id = idParam(params.rid);
  if (!id) return null;
  return <DiagramScreen id={id} />;
}
