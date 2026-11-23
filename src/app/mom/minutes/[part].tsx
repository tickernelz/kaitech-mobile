import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import type { MinutesPart } from '../../../features/mom/minutes';
import { MinutesPartScreen } from '../../../features/mom/MinutesPartScreen';

const parts: MinutesPart[] = ['document', 'dynamics', 'milestones', 'context'];

export default function MinutesPartRoute() {
  const params = useLocalSearchParams<{ part: string; meeting: string }>();
  const part = parts.find((one) => one === params.part);
  const meeting = idParam(params.meeting);
  if (!part || !meeting) return null;
  return <MinutesPartScreen part={part} meeting={meeting} />;
}
