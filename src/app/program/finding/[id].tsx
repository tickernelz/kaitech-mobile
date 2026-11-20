import { useLocalSearchParams } from 'expo-router';
import { FindingScreen } from '../../../features/discovery/FindingScreen';
import { idParam } from '../../../features/discovery/params';

export default function FindingRoute() {
  const params = useLocalSearchParams<{ id: string; programme?: string }>();
  const id = idParam(params.id);
  return id ? <FindingScreen id={id} programme={idParam(params.programme)} /> : null;
}
