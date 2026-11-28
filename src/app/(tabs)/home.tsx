import { Redirect } from 'expo-router';
import { useCan } from '../../auth/useAccess';
import { ClientHome } from '../../features/client/ClientHome';

export default function HomeTab() {
  return useCan('client.home') ? <ClientHome /> : <Redirect href="/" />;
}
