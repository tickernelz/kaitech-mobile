import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { WatchScreen } from '../../../features/records/ClientScreens';

export default function WatchRoute() {
  const params = useLocalSearchParams<{ rid: string }>();
  const id = idParam(params.rid);
  if (!id) return null;
  return <WatchScreen id={id} />;
}
