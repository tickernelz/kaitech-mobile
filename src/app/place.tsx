import { useLocalSearchParams } from 'expo-router';
import { PlaceScreen } from '../features/chat/ui/PlaceScreen';

export default function Place() {
  const params = useLocalSearchParams<{ channel: string; message: string }>();
  return <PlaceScreen channelId={Number(params.channel)} messageId={Number(params.message)} />;
}
