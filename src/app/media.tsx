import { MediaViewer } from '../features/chat/ui/media/MediaViewer';
import { DialogLayer } from '../ui/Dialog';

export default function MediaScreen() {
  return (
    <>
      <MediaViewer />
      <DialogLayer />
    </>
  );
}
