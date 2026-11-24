import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { useCurrentProgramme } from '../../../features/discovery/Home';
import { SectionsScreen } from '../../../features/records/SectionsScreen';

export default function SectionsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const programme = idParam(params.id);
  const { current } = useCurrentProgramme();
  if (!programme) return null;
  return <SectionsScreen programme={programme} name={current?.id === programme ? current.name : undefined} />;
}
