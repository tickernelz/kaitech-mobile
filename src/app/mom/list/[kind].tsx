import { useLocalSearchParams } from 'expo-router';
import { RecordsScreen } from '../../../features/mom/RecordsScreen';
import type { RecordKind } from '../../../features/mom/records';

const kinds: RecordKind[] = ['recordings', 'minutes', 'removals'];

export default function RecordsRoute() {
  const params = useLocalSearchParams<{ kind: string }>();
  const kind = kinds.find((one) => one === params.kind);
  if (!kind) return null;
  return <RecordsScreen kind={kind} />;
}
