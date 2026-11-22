import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import type { AssistPart } from '../../../features/mom/assist';
import { AssistScreen } from '../../../features/mom/AssistScreen';

const parts: AssistPart[] = ['notes', 'solusi', 'tasks'];

export default function AssistRoute() {
  const params = useLocalSearchParams<{ part: string; meeting: string }>();
  const part = parts.find((one) => one === params.part);
  const meeting = idParam(params.meeting);
  if (!part || !meeting) return null;
  return <AssistScreen part={part} meeting={meeting} />;
}
