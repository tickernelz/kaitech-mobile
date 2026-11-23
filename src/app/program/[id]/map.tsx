import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { MapScreen } from '../../../features/records/ClientScreens';

export default function MapRoute() {
  const params = useLocalSearchParams<{ id: string; rid: string }>();
  const programme = idParam(params.id);
  const id = idParam(params.rid);
  if (!programme || !id) return null;
  return <MapScreen programme={programme} id={id} />;
}
