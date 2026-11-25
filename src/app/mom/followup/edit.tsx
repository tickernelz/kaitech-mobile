import { useLocalSearchParams } from 'expo-router';
import { idParam } from '../../../features/discovery/params';
import { FollowupFormScreen } from '../../../features/mom/FollowupFormScreen';
import { DialogLayer } from '../../../ui/Dialog';

export default function FollowupEditRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = idParam(params.id);
  if (!id) return null;
  return (
    <>
      <FollowupFormScreen id={id} />
      <DialogLayer />
    </>
  );
}
