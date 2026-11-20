import { useLocalSearchParams } from 'expo-router';
import { CoworkerScreen } from '../../../features/discovery/CoworkerScreen';
import { idParam, textParam } from '../../../features/discovery/params';

export default function CoworkerRoute() {
  const params = useLocalSearchParams<{ id: string; conversation?: string; card?: string; prefill?: string }>();
  const programme = idParam(params.id);
  if (!programme) return null;
  return (
    <CoworkerScreen
      programme={programme}
      conversation={idParam(params.conversation)}
      card={idParam(params.card)}
      prefill={textParam(params.prefill)}
    />
  );
}
